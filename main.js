/* --- START OF FILE main.js (Safe Mode) --- */

document.addEventListener('DOMContentLoaded', function() {

    // 1. التحقق من تسجيل الدخول
    // إذا كنت تفتح ملف main.html مباشرة دون المرور بـ index.html، قد تحتاج لإيقاف هذا السطر مؤقتاً للتجربة
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (!loggedInUser) { 
        console.warn("No user logged in, redirecting...");
        window.location.href = 'index.html'; 
        return; 
    }

    // --- تعريف المتغيرات وقاعدة البيانات ---
    let invoicesDB = [], receiptsDB = [], itemsDB = [], customersDB = [], suppliersDB = [], purchasesDB = [], sellerInfo = {};
    let editingInvoiceId = null, editingReceiptId = null, editingItemId = null;

    // القيم الافتراضية لتجنب الأخطاء
    const defaultSellerInfo = { 
        name: "اسم الشركة", taxNumber: "", phone: "", logo: "", 
        address: { city:"", district:"", street:"", build:"", zip:"", addNo:"" } 
    };

    // --- دوال مساعدة (Helpers) ---
    const $ = (id) => {
        const el = document.getElementById(id);
        if (!el) console.warn(`Element with ID '${id}' not found.`);
        return el;
    };
    
    const toLocalISO = (d) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '';
    const formatMoney = (n) => parseFloat(n || 0).toFixed(2);

    // دالة اقتراح الرقم التالي
    function getNextNumber(db, prefix) {
        if (!db || db.length === 0) return `${prefix}-001`;
        try {
            const last = db[db.length-1];
            let numStr = "";
            if(prefix === "INV") numStr = last.invoiceNumber;
            else if(prefix === "PUR") numStr = last.invoiceNumber;
            else if(prefix === "REC") numStr = last.receiptNumber;
            
            const matches = numStr.match(/\d+$/);
            if(matches) {
                const nextVal = parseInt(matches[0]) + 1;
                return numStr.replace(/\d+$/, String(nextVal).padStart(matches[0].length, '0'));
            }
        } catch(e) { console.error("Error generating number", e); }
        return `${prefix}-${Date.now()}`;
    }

    // --- التخزين المحلي (Local Storage) ---
    function saveAllData() {
        try {
            const data = { invoicesDB, receiptsDB, itemsDB, customersDB, suppliersDB, purchasesDB, sellerInfo };
            localStorage.setItem(`accData_${loggedInUser}`, JSON.stringify(data));
        } catch (e) { alert("حدث خطأ أثناء الحفظ: مساحة التخزين ممتلئة أو محظورة."); }
    }
    
    function loadAllData() {
        try {
            const raw = localStorage.getItem(`accData_${loggedInUser}`);
            if (raw) {
                const d = JSON.parse(raw);
                invoicesDB = d.invoicesDB || [];
                receiptsDB = d.receiptsDB || [];
                itemsDB = d.itemsDB || [];
                customersDB = d.customersDB || [];
                suppliersDB = d.suppliersDB || [];
                purchasesDB = d.purchasesDB || [];
                
                // دمج البيانات القديمة مع الهيكل الجديد
                sellerInfo = { ...defaultSellerInfo, ...d.sellerInfo };
                if(typeof sellerInfo.address !== 'object') sellerInfo.address = defaultSellerInfo.address;
                
            } else {
                sellerInfo = defaultSellerInfo;
            }
            
            // تحميل الشعار إذا وجد
            if(sellerInfo.logo && $('logoPreview')) $('logoPreview').src = sellerInfo.logo;
            
        } catch (e) {
            console.error("Critical Error Loading Data:", e);
            alert("هناك مشكلة في تحميل البيانات القديمة. قد تحتاج لمسح البيانات.");
            sellerInfo = defaultSellerInfo;
        }
    }

    // --- دوال العرض (Renderers) ---
    function renderAllLogs() {
        renderInvoiceLog();
        renderReceiptLog();
        renderItemsLog();
        renderCustomersLog();
        renderSuppliersLog();
        renderPurchaseLog();
        populateDatalists();
    }

    function populateDatalists() {
        const custDL = $('customersDatalist'); 
        if(custDL) {
            custDL.innerHTML = '';
            customersDB.forEach(c => custDL.innerHTML += `<option value="${c.name}" data-code="${c.id}">`);
        }
        
        const supDL = $('suppliersDatalist'); 
        if(supDL) {
            supDL.innerHTML = '';
            suppliersDB.forEach(s => supDL.innerHTML += `<option value="${s.name}" data-code="${s.id}">`);
        }

        const itemDL = $('itemsDatalist'); 
        if(itemDL) {
            itemDL.innerHTML = '';
            itemsDB.forEach(i => itemDL.innerHTML += `<option value="${i.name}" data-price="${i.price}">`);
        }
    }

    // --- سجل الفواتير ---
    function renderInvoiceLog() {
        const tbody = $('invoiceLogBody'); if(!tbody) return;
        tbody.innerHTML = '';
        invoicesDB.slice().reverse().forEach(inv => {
            tbody.innerHTML += `<tr><td>${inv.invoiceNumber}</td><td>${formatDate(inv.invoiceDate)}</td><td>${inv.customerName}</td><td>${inv.grandTotal}</td>
            <td class="actions">
                <button class="btn warning small-action" onclick="editInvoice('${inv.invoiceNumber}')">تعديل</button>
                <button class="btn secondary small-action" onclick="printInvoice('${inv.invoiceNumber}')">طباعة</button>
            </td></tr>`;
        });
    }

    // --- سجل السندات ---
    function renderReceiptLog() {
        const tbody = $('receiptLogBody'); if(!tbody) return;
        tbody.innerHTML = '';
        receiptsDB.slice().reverse().forEach(r => {
            tbody.innerHTML += `<tr><td>${r.receiptNumber}</td><td>${formatDate(r.date)}</td><td>${r.customerName}</td><td>${formatMoney(r.amount)}</td>
            <td class="actions">
                <button class="btn warning small-action" onclick="editReceipt('${r.receiptNumber}')">تعديل</button>
                <button class="btn secondary small-action" onclick="printReceipt('${r.receiptNumber}')">طباعة</button>
            </td></tr>`;
        });
    }

    // --- سجل الأصناف ---
    function renderItemsLog() {
        const tbody = $('itemsLogBody'); if(!tbody) return;
        tbody.innerHTML = '';
        itemsDB.forEach((item, idx) => {
            const sold = getItemSoldQty(item.name);
            tbody.innerHTML += `<tr><td>${item.name}</td><td>${item.price}</td><td>${sold}</td>
            <td class="actions">
                <button class="btn warning small-action" onclick="editItem(${idx})">تعديل</button>
                <button class="btn danger small-action" onclick="deleteItem(${idx})">حذف</button>
            </td></tr>`;
        });
    }

    // --- سجل العملاء ---
    function renderCustomersLog() {
        const tbody = $('customersLogBody'); if(!tbody) return;
        tbody.innerHTML = '';
        customersDB.forEach(c => {
            tbody.innerHTML += `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.phone}</td><td>${getCustomerBalance(c.id)}</td>
            <td class="actions">
                <button class="btn warning small-action" onclick="editCustomer('${c.id}')">تعديل</button>
                <button class="btn info small-action" onclick="printStatement('${c.id}', 'customer')">كشف</button>
            </td></tr>`;
        });
    }

    // --- سجل الموردين ---
    function renderSuppliersLog() {
        const tbody = $('suppliersLogBody'); if(!tbody) return;
        tbody.innerHTML = '';
        suppliersDB.forEach(s => {
            tbody.innerHTML += `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.phone}</td><td>${getSupplierBalance(s.id)}</td>
            <td class="actions">
                <button class="btn warning small-action" onclick="editSupplier('${s.id}')">تعديل</button>
                <button class="btn info small-action" onclick="printStatement('${s.id}', 'supplier')">كشف</button>
            </td></tr>`;
        });
    }

    // --- سجل المشتريات ---
    function renderPurchaseLog() {
        const tbody = $('purchaseLogBody'); if(!tbody) return;
        tbody.innerHTML = '';
        purchasesDB.slice().reverse().forEach(p => {
            tbody.innerHTML += `<tr><td>${p.invoiceNumber}</td><td>${formatDate(p.invoiceDate)}</td><td>${p.supplierName}</td><td>${p.grandTotal}</td>
            <td class="actions">
                <button class="btn secondary small-action" onclick="printPurchase('${p.invoiceNumber}')">طباعة</button>
            </td></tr>`;
        });
    }

    // --- الحسابات ---
    const getCustomerBalance = (id) => {
        const sales = invoicesDB.filter(i => i.customerCode == id).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
        const collected = receiptsDB.filter(r => r.customerCode == id).reduce((a, b) => a + parseFloat(b.amount || 0), 0);
        return formatMoney(sales - collected);
    };
    const getSupplierBalance = (id) => {
        const bought = purchasesDB.filter(p => p.supplierCode == id).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
        return formatMoney(bought);
    };
    const getItemSoldQty = (name) => invoicesDB.reduce((acc, inv) => acc + (inv.items || []).filter(i => i.description === name).reduce((s, it) => s + parseFloat(it.quantity || 0), 0), 0);

    // --- الأحداث (Event Listeners) ---

    // تفاصيل مديونية العميل عند اختياره
    if($('customerName')) {
        $('customerName').addEventListener('input', function() {
            const val = this.value;
            const custDL = $('customersDatalist');
            if(!custDL) return;
            const opt = Array.from(custDL.options).find(o => o.value === val);
            const box = $('customerDebtDetails');
            
            if (opt) {
                const code = opt.dataset.code;
                const cust = customersDB.find(c => c.id === code);
                if($('customerTaxNumber')) $('customerTaxNumber').value = cust ? cust.taxNumber : '';
                
                const totalDebt = getCustomerBalance(code);
                const lastInvoices = invoicesDB.filter(i => i.customerCode == code).slice(-5).reverse();
                
                let html = `<h4>ملخص حساب: ${val}</h4>`;
                html += `<div><strong>الرصيد المستحق: ${totalDebt} SAR</strong></div>`;
                html += `<div style="margin-top:5px; border-top:1px dashed #ccc; padding-top:5px">آخر 5 فواتير:</div>`;
                if(lastInvoices.length > 0) {
                    html += `<ul style="margin:5px 0; padding-right:20px; list-style:circle;">`;
                    lastInvoices.forEach(inv => {
                        html += `<li>${inv.invoiceNumber} (${formatDate(inv.invoiceDate)}) - ${inv.grandTotal}</li>`;
                    });
                    html += `</ul>`;
                } else { html += `<div class="small">لا توجد فواتير سابقة</div>`; }
                
                if(box) { box.innerHTML = html; box.style.display = 'block'; }
            } else {
                if($('customerTaxNumber')) $('customerTaxNumber').value = '';
                if(box) box.style.display = 'none';
            }
        });
    }

    // إدارة عناصر الفاتورة
    window.addItem = (desc='', qty=1, price=0) => {
        const tbody = $('itemsBody'); if(!tbody) return;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input class="itm-desc" value="${desc}" list="itemsDatalist"></td>
                        <td><input class="itm-qty" type="number" value="${qty}"></td>
                        <td><input class="itm-price" type="number" value="${price}"></td>
                        <td class="itm-total">0.00</td>
                        <td><button class="btn danger small-action" onclick="this.closest('tr').remove();calcInvoice();">x</button></td>`;
        tbody.appendChild(tr);
        
        // ربط الأحداث داخل الصف الجديد
        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', calcInvoice));
        const descInput = tr.querySelector('.itm-desc');
        if(descInput) {
            descInput.addEventListener('change', function(){
               const opt = Array.from($('itemsDatalist').options).find(o=>o.value===this.value);
               if(opt) tr.querySelector('.itm-price').value = opt.dataset.price;
               calcInvoice();
            });
        }
        calcInvoice();
    };

    window.calcInvoice = () => {
        let sub = 0;
        document.querySelectorAll('#itemsBody tr').forEach(row => {
            const q = parseFloat(row.querySelector('.itm-qty').value)||0;
            const p = parseFloat(row.querySelector('.itm-price').value)||0;
            const t = q*p;
            row.querySelector('.itm-total').innerText = formatMoney(t);
            sub += t;
        });
        const vat = sub * 0.15;
        if($('subTotal')) $('subTotal').innerText = formatMoney(sub);
        if($('vatTotal')) $('vatTotal').innerText = formatMoney(vat);
        if($('grandTotal')) $('grandTotal').innerText = formatMoney(sub + vat);
    };

    // أزرار الفاتورة
    if($('newInvoiceBtn')) $('newInvoiceBtn').onclick = () => { 
        editingInvoiceId=null; 
        if($('invoiceNumber')) {
            const nextNum = getNextNumber(invoicesDB, 'INV');
            $('invoiceNumber').value = nextNum; 
            if($('invoiceNumHint')) $('invoiceNumHint').innerText = `مقترح: ${nextNum}`;
        }
        if($('invoiceDate')) $('invoiceDate').value=toLocalISO(new Date()); 
        if($('itemsBody')) $('itemsBody').innerHTML=''; 
        if($('customerName')) $('customerName').value='';
        if($('customerTaxNumber')) $('customerTaxNumber').value='';
        if($('customerDebtDetails')) $('customerDebtDetails').style.display='none';
        
        addItem(); 
        if(window.calcInvoice) window.calcInvoice(); 
    };

    if($('generateBtn')) $('generateBtn').onclick = () => {
        const custName = $('customerName').value;
        const custOpt = Array.from($('customersDatalist').options).find(o=>o.value===custName);
        if(!custOpt) return alert('الرجاء اختيار عميل موجود في القائمة');
        
        const invNum = $('invoiceNumber').value;
        if(!invNum) return alert('رقم الفاتورة مطلوب');

        const data = {
            invoiceNumber: invNum,
            invoiceDate: $('invoiceDate').value,
            customerCode: custOpt.dataset.code, customerName: custName,
            subTotal: $('subTotal').innerText, vatTotal: $('vatTotal').innerText, grandTotal: $('grandTotal').innerText,
            items: Array.from(document.querySelectorAll('#itemsBody tr')).map(r => ({
                description: r.querySelector('.itm-desc').value, 
                quantity: r.querySelector('.itm-qty').value, 
                price: r.querySelector('.itm-price').value, 
                total: r.querySelector('.itm-total').innerText
            }))
        };
        
        if(editingInvoiceId) {
            const idx = invoicesDB.findIndex(i=>i.invoiceNumber===editingInvoiceId);
            if(idx > -1) invoicesDB[idx] = data;
        } else { invoicesDB.push(data); }
        
        saveAllData(); renderAllLogs(); 
        alert("تم الحفظ بنجاح");
        $('newInvoiceBtn').click();
    };

    // --- المشتريات ---
    window.addPurchaseItem = () => {
        const tbody = $('purchaseItemsBody'); if(!tbody) return;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input class="p-desc" list="itemsDatalist"></td>
                        <td><input class="p-qty" type="number" value="1"></td>
                        <td><input class="p-cost" type="number" value="0"></td>
                        <td class="p-total">0.00</td>
                        <td><button class="btn danger small-action" onclick="this.closest('tr').remove();calcPurchase();">x</button></td>`;
        tbody.appendChild(tr);
        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', calcPurchase));
    };

    window.calcPurchase = () => {
        let sub = 0;
        document.querySelectorAll('#purchaseItemsBody tr').forEach(row => {
            const q = parseFloat(row.querySelector('.p-qty').value)||0;
            const c = parseFloat(row.querySelector('.p-cost').value)||0;
            const t = q*c;
            row.querySelector('.p-total').innerText = formatMoney(t);
            sub += t;
        });
        const vat = sub * 0.15;
        if($('purchaseSubTotal')) $('purchaseSubTotal').innerText = formatMoney(sub);
        if($('purchaseVatTotal')) $('purchaseVatTotal').innerText = formatMoney(vat);
        if($('purchaseGrandTotal')) $('purchaseGrandTotal').innerText = formatMoney(sub + vat);
    };

    if($('addPurchaseItemBtn')) $('addPurchaseItemBtn').onclick = addPurchaseItem;
    
    if($('newPurchaseBtn')) $('newPurchaseBtn').onclick = () => { 
        if($('purchaseNumber')) $('purchaseNumber').value = ''; 
        if($('purchaseDate')) $('purchaseDate').value=toLocalISO(new Date()); 
        if($('purchaseItemsBody')) $('purchaseItemsBody').innerHTML=''; 
        if($('supplierName')) $('supplierName').value='';
        addPurchaseItem(); 
    };

    if($('savePurchaseBtn')) $('savePurchaseBtn').onclick = () => {
        const supName = $('supplierName').value;
        const supOpt = Array.from($('suppliersDatalist').options).find(o=>o.value===supName);
        if(!supOpt) return alert('اختر مورداً صحيحاً');

        const data = {
            invoiceNumber: $('purchaseNumber').value || `PUR-${Date.now()}`,
            invoiceDate: $('purchaseDate').value,
            supplierCode: supOpt.dataset.code, supplierName: supName,
            grandTotal: $('purchaseGrandTotal').innerText,
            items: Array.from(document.querySelectorAll('#purchaseItemsBody tr')).map(r => ({
                description: r.querySelector('.p-desc').value, quantity: r.querySelector('.p-qty').value, cost: r.querySelector('.p-cost').value
            }))
        };
        purchasesDB.push(data);
        saveAllData(); renderAllLogs(); alert("تم حفظ الشراء"); $('newPurchaseBtn').click();
    };

    // --- العملاء والموردين ---
    if($('saveCustomerBtn')) $('saveCustomerBtn').onclick = () => {
        const data = { 
            id: $('custCode').value, name: $('custName').value, taxNumber: $('custTaxNumber').value, phone: $('custPhone').value,
            address: {
                city: $('custCity').value, district: $('custDistrict').value, street: $('custStreet').value,
                build: $('custBuild').value, zip: $('custZip').value, addNo: $('custAddNo').value
            }
        };
        if(!data.id || !data.name) return alert('الكود والاسم مطلوبان');
        const idx = customersDB.findIndex(c=>c.id===data.id);
        if(idx > -1) customersDB[idx] = data; else customersDB.push(data);
        saveAllData(); renderAllLogs(); $('clearCustomerFormBtn').click();
    };
    
    if($('clearCustomerFormBtn')) $('clearCustomerFormBtn').onclick = () => { 
        ['custCode','custName','custTaxNumber','custPhone','custCity','custDistrict','custStreet','custBuild','custZip','custAddNo']
        .forEach(id => { if($(id)) $(id).value = ''; });
    };

    if($('saveSupplierBtn')) $('saveSupplierBtn').onclick = () => {
        const data = { 
            id: $('supCode').value, name: $('supName').value, taxNumber: $('supTaxNumber').value, phone: $('supPhone').value,
            address: {
                city: $('supCity').value, district: $('supDistrict').value, street: $('supStreet').value,
                build: $('supBuild').value, zip: $('supZip').value, addNo: $('supAddNo').value
            }
        };
        if(!data.id || !data.name) return alert('الكود والاسم مطلوبان');
        const idx = suppliersDB.findIndex(s=>s.id===data.id);
        if(idx > -1) suppliersDB[idx] = data; else suppliersDB.push(data);
        saveAllData(); renderAllLogs(); $('clearSupplierFormBtn').click();
    };
    
    if($('clearSupplierFormBtn')) $('clearSupplierFormBtn').onclick = () => { 
        ['supCode','supName','supTaxNumber','supPhone','supCity','supDistrict','supStreet','supBuild','supZip','supAddNo']
        .forEach(id => { if($(id)) $(id).value = ''; });
    };

    // --- الأصناف والسندات ---
    if($('saveItemBtn')) $('saveItemBtn').onclick = () => {
        const name = $('itemName').value; const price = $('itemPrice').value;
        if(!name) return;
        if(editingItemId!==null) itemsDB[editingItemId] = {name, price}; else itemsDB.push({name, price});
        saveAllData(); renderAllLogs(); $('clearItemFormBtn').click();
    };
    if($('clearItemFormBtn')) $('clearItemFormBtn').onclick = () => { editingItemId=null; $('itemName').value=''; $('itemPrice').value=''; };

    if($('saveReceiptBtn')) $('saveReceiptBtn').onclick = () => {
        const custName = $('receiptCustomerName').value;
        const custOpt = Array.from($('customersDatalist').options).find(o=>o.value===custName);
        if(!custOpt) return alert('اختر عميلاً');
        
        const data = {
            receiptNumber: $('receiptNumber').value, date: $('receiptDate').value,
            customerCode: custOpt.dataset.code, customerName: custName,
            amount: $('amountReceived').value, paymentMethod: $('paymentMethod').value, description: $('receiptDescription').value
        };
        if(editingReceiptId) {
            const idx = receiptsDB.findIndex(r=>r.receiptNumber===editingReceiptId);
            if(idx>-1) receiptsDB[idx] = data;
        } else { receiptsDB.push(data); }
        
        saveAllData(); renderAllLogs(); alert("تم حفظ السند"); $('newReceiptBtn').click();
    };

    if($('newReceiptBtn')) $('newReceiptBtn').onclick = () => { 
        editingReceiptId=null; 
        if($('receiptNumber')) $('receiptNumber').value = getNextNumber(receiptsDB, 'REC');
        if($('receiptDate')) $('receiptDate').value=toLocalISO(new Date()); 
        if($('amountReceived')) $('amountReceived').value=''; 
        if($('receiptDescription')) $('receiptDescription').value=''; 
    };

    // --- دوال عامة (نافذة) ---
    // هذه الدوال مرتبطة بـ onclick في HTML لذا يجب تعريفها في window
    window.editInvoice = (id) => {
        const inv = invoicesDB.find(i=>i.invoiceNumber===id);
        if(!inv) return;
        editingInvoiceId = id;
        $('invoiceNumber').value=inv.invoiceNumber; $('invoiceDate').value=inv.invoiceDate; $('customerName').value=inv.customerName;
        // تفعيل حدث الإدخال لعرض الديون
        $('customerName').dispatchEvent(new Event('input'));
        $('itemsBody').innerHTML='';
        (inv.items || []).forEach(i=>addItem(i.description, i.quantity, i.price));
        calcInvoice();
        $('.tab-btn[data-tab="invoiceTab"]').click(); $('.sub-tab-btn[data-tab="createInvoice"]').click();
    };

    window.editCustomer = (id) => {
        const c = customersDB.find(x=>x.id===id); if(!c) return;
        $('custCode').value=c.id; $('custName').value=c.name; $('custTaxNumber').value=c.taxNumber; $('custPhone').value=c.phone;
        const addr = c.address || {};
        $('custCity').value=addr.city||''; $('custDistrict').value=addr.district||''; $('custStreet').value=addr.street||'';
        $('custBuild').value=addr.build||''; $('custZip').value=addr.zip||''; $('custAddNo').value=addr.addNo||'';
        $('.tab-btn[data-tab="customersTab"]').click();
    };

    window.editSupplier = (id) => {
        const s = suppliersDB.find(x=>x.id===id); if(!s) return;
        $('supCode').value=s.id; $('supName').value=s.name; $('supTaxNumber').value=s.taxNumber; $('supPhone').value=s.phone;
        const addr = s.address || {};
        $('supCity').value=addr.city||''; $('supDistrict').value=addr.district||''; $('supStreet').value=addr.street||'';
        $('supBuild').value=addr.build||''; $('supZip').value=addr.zip||''; $('supAddNo').value=addr.addNo||'';
        $('.tab-btn[data-tab="suppliersTab"]').click();
    };

    window.editItem = (idx) => { 
        editingItemId=idx; 
        $('itemName').value=itemsDB[idx].name; $('itemPrice').value=itemsDB[idx].price; 
        $('.tab-btn[data-tab="itemsTab"]').click(); 
    };
    
    window.deleteItem = (idx) => { 
        if(confirm('حذف؟')) { itemsDB.splice(idx,1); saveAllData(); renderAllLogs(); } 
    };

    window.editReceipt = (id) => {
        const r = receiptsDB.find(x=>x.receiptNumber===id); if(!r) return;
        editingReceiptId = id;
        $('receiptNumber').value=r.receiptNumber; $('receiptDate').value=r.date;
        $('receiptCustomerName').value=r.customerName; $('amountReceived').value=r.amount; 
        $('paymentMethod').value=r.paymentMethod; $('receiptDescription').value=r.description;
        $('.tab-btn[data-tab="receiptTab"]').click();
    };

    // --- الطباعة ---
    function setPrintLogo(imgId) {
        const img = $(imgId);
        if(sellerInfo.logo) { img.src = sellerInfo.logo; img.style.display = 'block'; } else { img.style.display = 'none'; }
    }

    window.printInvoice = (id) => {
        const inv = invoicesDB.find(i=>i.invoiceNumber===id); if(!inv) return;
        setPrintLogo('printLogo');
        $('previewSellerName').innerText = sellerInfo.name;
        const sAddr = sellerInfo.address || {};
        $('previewSellerInfo').innerText = `هاتف: ${sellerInfo.phone} | ضريبي: ${sellerInfo.taxNumber}`;
        $('previewSellerAddress').innerText = `${sAddr.build||''} ${sAddr.street||''} - ${sAddr.district||''} - ${sAddr.city||''}`;
        
        $('previewInvoiceNo').innerText = inv.invoiceNumber;
        $('previewDate').innerText = formatDate(inv.invoiceDate);
        
        const cust = customersDB.find(c=>c.id===inv.customerCode);
        let clientHtml = `<div class="detail-row"><div class="detail-label">العميل:</div><div>${inv.customerName}</div></div>`;
        if(cust) {
            const cAddr = cust.address || {};
            const addrStr = `${cAddr.build||''} ${cAddr.street||''} - ${cAddr.district||''} - ${cAddr.city||''}`;
            clientHtml += `<div class="detail-row"><div class="detail-label">الرقم الضريبي:</div><div>${cust.taxNumber}</div></div>`+
                          `<div class="detail-row"><div class="detail-label">العنوان:</div><div>${addrStr}</div></div>`;
        }
        $('previewClient').innerHTML = clientHtml;

        let rows = `<table class="items-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>`;
        (inv.items || []).forEach(i => rows += `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${formatMoney(i.price)}</td><td>${formatMoney(i.total)}</td></tr>`);
        $('previewItems').innerHTML = rows + `</tbody></table>`;
        $('previewTotals').innerHTML = `<h3>الإجمالي الكلي: ${inv.grandTotal} SAR</h3>`;
        
        // ZATCA QR
        try {
            const tlv = `Seller:${sellerInfo.name}|Tax:${sellerInfo.taxNumber}|Date:${inv.invoiceDate}|Total:${inv.grandTotal}|VAT:${inv.vatTotal}`;
            $('qrContainer').innerHTML=''; new QRCode($('qrContainer'), {text: tlv, width:120, height:120});
        } catch(e) { console.error("QR Error", e); }

        document.body.className = 'printing-invoice';
        window.print();
    };

    window.printPurchase = (id) => {
        const pur = purchasesDB.find(p=>p.invoiceNumber===id); if(!pur) return;
        $('purPreviewSellerName').innerText = sellerInfo.name;
        $('purPreviewNo').innerText = pur.invoiceNumber;
        $('purPreviewDate').innerText = formatDate(pur.invoiceDate);
        $('purPreviewSupplier').innerHTML = `<div class="detail-row"><div class="detail-label">المورد:</div><div>${pur.supplierName}</div></div>`;
        
        let rows = `<table class="items-table"><thead><tr><th>الصنف</th><th>الكمية</th></tr></thead><tbody>`;
        (pur.items || []).forEach(i => rows += `<tr><td>${i.description}</td><td>${i.quantity}</td></tr>`);
        $('purPreviewItems').innerHTML = rows + `</tbody></table>`;
        $('purPreviewTotals').innerHTML = `<h3>الإجمالي: ${pur.grandTotal} SAR</h3>`;
        
        document.body.className = 'printing-purchase';
        window.print();
    };

    window.printReceipt = (id) => {
        const r = receiptsDB.find(x=>x.receiptNumber===id); if(!r) return;
        setPrintLogo('printReceiptLogo');
        $('receiptPreviewSellerName').innerText = sellerInfo.name;
        $('receiptPreviewSellerInfo').innerText = sellerInfo.phone;
        $('receiptPreviewNumber').innerText = r.receiptNumber;
        $('receiptPreviewDate').innerText = formatDate(r.date);
        $('receiptPreviewCustomer').innerText = r.customerName;
        $('receiptPreviewAmount').innerText = formatMoney(r.amount);
        $('receiptPreviewDesc').innerText = r.description;
        $('receiptPreviewPayment').innerText = r.paymentMethod;
        document.body.className = 'printing-receipt';
        window.print();
    };

    window.printStatement = (id, type) => {
        setPrintLogo('printStatementLogo');
        $('statementSellerName').innerText = sellerInfo.name;
        
        let txs = [], name = "";
        if(type === 'customer') {
            const c = customersDB.find(x=>x.id===id); if(c) name = c.name;
            invoicesDB.filter(i=>i.customerCode===id).forEach(i => txs.push({date:i.invoiceDate, desc:`فاتورة ${i.invoiceNumber}`, deb: i.grandTotal, cred: 0}));
            receiptsDB.filter(r=>r.customerCode===id).forEach(r => txs.push({date:r.date, desc:`سند ${r.receiptNumber}`, deb: 0, cred: r.amount}));
        } else {
            const s = suppliersDB.find(x=>x.id===id); if(s) name = s.name;
            purchasesDB.filter(p=>p.supplierCode===id).forEach(p => txs.push({date:p.invoiceDate, desc:`شراء ${p.invoiceNumber}`, deb: 0, cred: p.grandTotal}));
        }
        
        txs.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        $('statementClientInfo').innerHTML = `<strong>الاسم:</strong> ${name}`;
        let bal = 0, html = '';
        txs.forEach(t => {
            bal += (parseFloat(t.deb || 0) - parseFloat(t.cred || 0));
            html += `<tr><td>${formatDate(t.date)}</td><td>${t.desc}</td><td>${formatMoney(t.deb)}</td><td>${formatMoney(t.cred)}</td><td>${formatMoney(bal)}</td></tr>`;
        });
        $('statementTableBody').innerHTML = html;
        $('statementSummary').innerHTML = `<h3>الرصيد الختامي: ${formatMoney(bal)}</h3>`;
        document.body.className = 'printing-statement';
        window.print();
    };

    // --- التقارير ---
    if($('generateReportBtn')) $('generateReportBtn').onclick = () => {
        const type = $('reportType').value;
        const start = new Date($('reportStartDate').value || '2000-01-01');
        const end = new Date($('reportEndDate').value || '2100-01-01');
        end.setHours(23,59,59);

        let data = [], cols = [], title = "", summary = "";
        
        if (type === 'sales') {
            title = "تقرير المبيعات";
            const filtered = invoicesDB.filter(i => new Date(i.invoiceDate) >= start && new Date(i.invoiceDate) <= end);
            cols = ['رقم الفاتورة', 'التاريخ', 'العميل', 'الإجمالي'];
            data = filtered.map(i => [i.invoiceNumber, formatDate(i.invoiceDate), i.customerName, i.grandTotal]);
            const total = filtered.reduce((a,b)=>a+parseFloat(b.grandTotal||0),0);
            summary = `<div class="report-card"><h3>إجمالي المبيعات</h3><div class="value">${formatMoney(total)}</div></div>`;
        }
        else if (type === 'purchases') {
            title = "تقرير المشتريات";
            const filtered = purchasesDB.filter(p => new Date(p.invoiceDate) >= start && new Date(p.invoiceDate) <= end);
            cols = ['رقم الفاتورة', 'التاريخ', 'المورد', 'الإجمالي'];
            data = filtered.map(p => [p.invoiceNumber, formatDate(p.invoiceDate), p.supplierName, p.grandTotal]);
            const total = filtered.reduce((a,b)=>a+parseFloat(b.grandTotal||0),0);
            summary = `<div class="report-card"><h3>إجمالي المشتريات</h3><div class="value">${formatMoney(total)}</div></div>`;
        }
        else if (type === 'collections') {
            title = "تقرير التحصيلات";
            const filtered = receiptsDB.filter(r => new Date(r.date) >= start && new Date(r.date) <= end);
            cols = ['رقم السند', 'التاريخ', 'العميل', 'طريقة الدفع', 'المبلغ'];
            data = filtered.map(r => [r.receiptNumber, formatDate(r.date), r.customerName, r.paymentMethod, formatMoney(r.amount)]);
            const total = filtered.reduce((a,b)=>a+parseFloat(b.amount||0),0);
            summary = `<div class="report-card"><h3>إجمالي المقبوضات</h3><div class="value">${formatMoney(total)}</div></div>`;
        }
        else if (type === 'inventory') {
            title = "حركة المخزون";
            cols = ['اسم الصنف', 'الكمية المشتراة', 'الكمية المباعة', 'المخزون النظري'];
            data = itemsDB.map(item => {
                const bought = purchasesDB.reduce((acc, pur) => acc + (pur.items||[]).filter(i => i.description === item.name).reduce((s, it) => s + parseFloat(it.quantity||0), 0), 0);
                const sold = getItemSoldQty(item.name);
                return [item.name, bought, sold, (bought - sold)];
            });
        }
        else if (type === 'customerDebts') {
            title = "مديونية العملاء";
            cols = ['كود العميل', 'الاسم', 'الهاتف', 'الرصيد المستحق'];
            data = customersDB.map(c => [c.id, c.name, c.phone, getCustomerBalance(c.id)]).filter(row => parseFloat(row[3]) !== 0);
        }

        $('reportTitleDisplay').innerText = title;
        $('reportDateRangeDisplay').innerText = `${formatDate(start)} - ${formatDate(end)}`;
        $('reportHeader').style.display = 'block';
        $('reportSummaryCards').innerHTML = summary;
        
        const thead = $('reportTable').querySelector('thead');
        thead.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
        
        const tbody = $('reportTable').querySelector('tbody');
        tbody.innerHTML = data.map(row => '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>').join('');
    };

    if($('printReportBtn')) $('printReportBtn').onclick = () => { 
        document.body.className = 'printing-report'; 
        window.print(); 
    };

    if($('exportExcelBtn')) $('exportExcelBtn').onclick = () => {
        const tbl = document.getElementById('reportTable');
        if(!tbl || tbl.rows.length === 0) return alert('لا توجد بيانات للتصدير');
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(tbl);
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, "Report.xlsx");
    };

    // --- الإعدادات ---
    if($('logoUpload')) $('logoUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            if(evt.target.result.length > 800000) { alert('الصورة كبيرة جداً، يفضل أقل من 500kb'); }
            sellerInfo.logo = evt.target.result;
            if($('logoPreview')) {
                $('logoPreview').src = sellerInfo.logo;
                $('logoPreview').style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    });

    if($('saveSettingsBtn')) $('saveSettingsBtn').onclick = () => {
        sellerInfo.name = $('settingSellerName').value;
        sellerInfo.taxNumber = $('settingSellerTaxNum').value;
        sellerInfo.phone = $('settingSellerPhone').value;
        sellerInfo.address = {
            city: $('setCity').value, district: $('setDistrict').value, street: $('setStreet').value,
            build: $('setBuild').value, zip: $('setZip').value, addNo: $('setAddNo').value
        };
        saveAllData(); alert('تم الحفظ');
    };
    
    if($('exportAllBtn')) $('exportAllBtn').onclick = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoicesDB), "Sales");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchasesDB), "Purchases");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customersDB), "Customers");
        XLSX.writeFile(wb, "Backup.xlsx");
    };
    
    if($('clearAllDataBtn')) $('clearAllDataBtn').onclick = () => { 
        if(confirm('تحذير: سيتم حذف جميع البيانات. هل أنت متأكد؟')) { 
            localStorage.removeItem(`accData_${loggedInUser}`); 
            location.reload(); 
        }
    };

    // --- التهيئة الأولية (Initialization) ---
    loadAllData();
    
    // تعبئة حقول الإعدادات
    if($('settingSellerName')) $('settingSellerName').value = sellerInfo.name || '';
    if($('settingSellerTaxNum')) $('settingSellerTaxNum').value = sellerInfo.taxNumber || '';
    if($('settingSellerPhone')) $('settingSellerPhone').value = sellerInfo.phone || '';
    const sAddr = sellerInfo.address || {};
    if($('setCity')) $('setCity').value=sAddr.city||''; 
    if($('setDistrict')) $('setDistrict').value=sAddr.district||''; 
    if($('setStreet')) $('setStreet').value=sAddr.street||'';
    if($('setBuild')) $('setBuild').value=sAddr.build||''; 
    if($('setZip')) $('setZip').value=sAddr.zip||''; 
    if($('setAddNo')) $('setAddNo').value=sAddr.addNo||'';

    // تبديل التبويبات (Tabs)
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active')); 
        if($(b.dataset.tab)) $(b.dataset.tab).classList.add('active');
    }));
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.addEventListener('click', () => {
        const p = $(b.dataset.parent);
        if(!p) return;
        p.querySelectorAll('.sub-tab-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        p.querySelectorAll('.sub-tab-content').forEach(x=>x.classList.remove('active')); 
        if($(b.dataset.tab)) $(b.dataset.tab).classList.add('active');
    }));

    // بدء التطبيق
    if($('newInvoiceBtn')) $('newInvoiceBtn').click();
    if($('newPurchaseBtn')) $('newPurchaseBtn').click();
    if($('newReceiptBtn')) $('newReceiptBtn').click();
    renderAllLogs();
    
    window.onafterprint = () => document.body.className = '';
});
