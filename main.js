document.addEventListener('DOMContentLoaded', function() {
    // ============================================================
    // 1. المتغيرات والتهيئة (Variables & Init)
    // ============================================================
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (!loggedInUser) { window.location.href = 'index.html'; return; }

    let invoicesDB=[], receiptsDB=[], itemsDB=[], customersDB=[], sellerInfo={};
    let suppliersDB=[], purchaseInvoicesDB=[], paymentVouchersDB=[];
    let currentReportData=null;
    let currentLang = 'ar';
    
    // حالات التعديل
    let editingInvoiceId=null, editingReceiptId=null, editingItemId=null, editingCustomerId=null;
    let editingPurchaseId=null, editingPaymentId=null, editingSupplierId=null;

    const defaultSellerInfo = { name: "شركتي", taxNumber: "300000000000003", address: "الرياض", phone: "0500000000", logo: "" };
    
    // ============================================================
    // 2. دوال مساعدة (Helpers)
    // ============================================================
    const $ = id => document.getElementById(id);
    const toLocal = (d = new Date()) => new Date(d.getTime() - (d.getTimezoneOffset()*60000)).toISOString().slice(0, 16);
    const formatDate = d => { if(!d) return ''; const x=new Date(d); return `${x.getDate().toString().padStart(2,'0')}-${(x.getMonth()+1).toString().padStart(2,'0')}-${x.getFullYear()}`; };
    const num = v => parseFloat(v)||0;
    const escapeHTML = s => (s||'').toString().replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);

    function getNextId(db, prop, prefix) {
        if(!db || db.length===0) return prefix+"-001";
        const nums = db.map(x => parseInt(x[prop].replace(prefix+'-','')) || 0);
        return prefix + "-" + String(Math.max(...nums)+1).padStart(3, '0');
    }

    // ============================================================
    // 3. دوال إعادة التعيين (Reset Functions)
    // ============================================================
    function resetSalesForm(){
        editingInvoiceId=null;
        $('invoiceNumber').value=''; $('invoiceNumber').placeholder='Auto';
        $('invoiceDate').value=toLocal();
        $('customerName').value=''; $('customerTaxNumber').value=''; $('invoiceDiscount').value=0;
        $('itemsBody').innerHTML=''; 
        window.addSalesItem(); 
        const statusBox = $('customerStatusBox'); if(statusBox) statusBox.style.display='none';
    }

    function resetReceiptForm(){
        editingReceiptId=null;
        $('receiptNumber').value=''; $('receiptNumber').placeholder='Auto';
        $('receiptDate').value=toLocal();
        $('receiptCustomerName').value=''; $('amountReceived').value=''; $('receiptDescription').value='';
        const statusBox = $('receiptCustomerStatusBox'); if(statusBox) statusBox.style.display='none';
        $('receiptAllocationBody').innerHTML=''; 
        $('receiptAllocationContainer').style.display='none';
    }

    function resetPurchaseForm(){
        editingPurchaseId=null;
        $('purchaseNumber').value=''; $('purchaseNumber').placeholder='Auto';
        $('purchaseDate').value=toLocal();
        $('supplierName').value=''; $('supplierTaxNumber').value=''; $('purchaseDiscount').value=0;
        $('purchaseItemsBody').innerHTML=''; 
        window.addPurItem(); 
        const statusBox = $('supplierStatusBox'); if(statusBox) statusBox.style.display='none';
    }

    function resetPaymentForm(){
        editingPaymentId=null;
        $('paymentNumber').value=''; $('paymentNumber').placeholder='Auto';
        $('paymentDate').value=toLocal();
        $('paymentSupplierName').value=''; $('amountPaid').value=''; $('paymentDescription').value='';
        const statusBox = $('paymentSupplierStatusBox'); if(statusBox) statusBox.style.display='none';
        $('paymentAllocationBody').innerHTML=''; 
        $('paymentAllocationContainer').style.display='none';
    }

    // ============================================================
    // 4. الترجمة (Translations)
    // ============================================================
    const translations = {
        ar: {
            pageTitle: "الخبير المحاسبي", logoutBtn: "تسجيل الخروج", salesTab: "المبيعات", purchasesTab: "المشتريات", 
            itemsTab: "الأصناف", reportsTab: "التقارير", settingsTab: "الإعدادات",
            createInvoiceSubTab: "فاتورة جديدة", invoiceLogSubTab: "سجل الفواتير", createReceiptSubTab: "سند تحصيل", receiptLogSubTab: "سجل السندات",
            customersTab: "العملاء", createPurchaseSubTab: "فاتورة شراء", purchaseLogSubTab: "سجل المشتريات", createPaymentSubTab: "سند صرف",
            paymentLogSubTab: "سجل الصرف", suppliersSubTab: "الموردين", newInvoiceBtn: "➕ جديد", generateBtn: "💾 حفظ",
            addItemBtn: "➕ صنف"
        },
        en: {
            pageTitle: "Al-Khabeer System", logoutBtn: "Logout", salesTab: "Sales", purchasesTab: "Purchases", 
            itemsTab: "Items", reportsTab: "Reports", settingsTab: "Settings",
            createInvoiceSubTab: "New Invoice", invoiceLogSubTab: "Invoices Log", createReceiptSubTab: "Receipt", receiptLogSubTab: "Receipts Log",
            customersTab: "Customers", createPurchaseSubTab: "New Bill", purchaseLogSubTab: "Bills Log", createPaymentSubTab: "Payment",
            paymentLogSubTab: "Payments Log", suppliersSubTab: "Suppliers", newInvoiceBtn: "➕ New", generateBtn: "💾 Save",
            addItemBtn: "➕ Add Item"
        }
    };

    function setLanguage(lang) {
        currentLang = lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        if($('langToggleBtn')) $('langToggleBtn').innerText = lang === 'ar' ? 'English' : 'العربية';
        
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.getAttribute('data-translate');
            if (translations[lang] && translations[lang][key]) el.innerText = translations[lang][key];
        });
    }

    // ============================================================
    // 5. تحميل وحفظ البيانات (Load/Save Data)
    // ============================================================
    function populateItemLists() {
        const dl = $('itemsDatalist');
        if(!dl) return;
        dl.innerHTML = '';
        itemsDB.forEach(i => dl.innerHTML += `<option value="${escapeHTML(i.name)}">${i.price}</option>`);
    }

    function renderAll() {
        populateItemLists();
        renderLog(invoicesDB, 'invoiceLogTable', 'invoice');
        renderLog(receiptsDB, 'receiptLogTable', 'receipt');
        renderLog(purchaseInvoicesDB, 'purchaseLogTable', 'purchase');
        renderLog(paymentVouchersDB, 'paymentLogTable', 'payment');

        const cBody=$('customersLogBody'); if(cBody){cBody.innerHTML=''; $('customersDatalist').innerHTML=''; customersDB.forEach(c=>{ $('customersDatalist').innerHTML+=`<option value="${c.name}" data-code="${c.id}">`; cBody.innerHTML+=`<tr><td>${c.id}</td><td>${c.name}</td><td>${getEntityFinancials(c.id,'customer').balance.toFixed(2)}</td><td>${c.discount||0}%</td><td class="actions"><button class="btn info small-action" onclick="printStatement('customer','${c.id}')">كشف</button><button class="btn warning small-action" onclick="addDiscount('customer','${c.id}')">خصم</button><button class="btn danger small-action" onclick="window.delRec('customer','${c.id}')">🗑</button></td></tr>`; });}
        const sBody=$('suppliersLogBody'); if(sBody){sBody.innerHTML=''; $('suppliersDatalist').innerHTML=''; suppliersDB.forEach(s=>{ $('suppliersDatalist').innerHTML+=`<option value="${s.name}" data-code="${s.id}">`; sBody.innerHTML+=`<tr><td>${s.id}</td><td>${s.name}</td><td>${getEntityFinancials(s.id,'supplier').balance.toFixed(2)}</td><td>${s.discount||0}%</td><td class="actions"><button class="btn info small-action" onclick="printStatement('supplier','${s.id}')">كشف</button><button class="btn warning small-action" onclick="addDiscount('supplier','${s.id}')">خصم</button><button class="btn danger small-action" onclick="window.delRec('supplier','${s.id}')">🗑</button></td></tr>`; });}
        const iBody=$('itemsLogBody'); if(iBody){iBody.innerHTML=''; itemsDB.forEach((i,idx)=>iBody.innerHTML+=`<tr><td>${i.name}</td><td>${i.price}</td><td class="actions"><button class="btn danger small-action" onclick="window.delRec('item',${idx})">🗑</button></td></tr>`);}
    }

    function loadData() {
        const d = JSON.parse(localStorage.getItem(`accData_${loggedInUser}`) || '{}');
        invoicesDB = d.invoicesDB || [];
        receiptsDB = d.receiptsDB || [];
        itemsDB = d.itemsDB || [];
        customersDB = d.customersDB || [];
        suppliersDB = d.suppliersDB || [];
        purchaseInvoicesDB = d.purchaseInvoicesDB || [];
        paymentVouchersDB = d.paymentVouchersDB || [];
        sellerInfo = d.sellerInfo || defaultSellerInfo;
        
        if(sellerInfo.name) {
            $('settingSellerName').value = sellerInfo.name;
            $('settingSellerTaxNum').value = sellerInfo.taxNumber;
            $('settingSellerAddress').value = sellerInfo.address;
            $('settingSellerPhone').value = sellerInfo.phone;
            if(sellerInfo.logo) {
                $('logoPreview').src = sellerInfo.logo;
                $('logoPreview').style.display = 'block';
            }
        }
        renderAll();
    }
    
    function saveData() {
        localStorage.setItem(`accData_${loggedInUser}`, JSON.stringify({
            invoicesDB, receiptsDB, itemsDB, customersDB, suppliersDB, purchaseInvoicesDB, paymentVouchersDB, sellerInfo
        }));
    }

    // ============================================================
    // 6. المنطق المالي (Financial Logic)
    // ============================================================
    function getEntityFinancials(id, type) {
        let invoices = [], payments = [];
        if (type === 'customer') {
            invoices = invoicesDB.filter(i => i.customerCode === id).map(i => ({...i, total: num(i.grandTotal)}));
            payments = receiptsDB.filter(r => r.customerCode === id).map(r => ({...r, amount: num(r.amount)}));
        } else {
            invoices = purchaseInvoicesDB.filter(i => i.supplierCode === id).map(i => ({...i, total: num(i.grandTotal)}));
            payments = paymentVouchersDB.filter(p => p.supplierCode === id).map(p => ({...p, amount: num(p.amount)}));
        }
        
        invoices.sort((a,b) => new Date(a.date||a.invoiceDate) - new Date(b.date||b.invoiceDate));
        payments.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        let totalInv = invoices.reduce((s,i) => s + i.total, 0);
        let totalPay = payments.reduce((s,p) => s + p.amount, 0);
        let remainingPool = totalPay;
        
        const agingData = invoices.map(inv => {
            let paid = 0;
            if (remainingPool > 0) {
                if (remainingPool >= inv.total) { paid = inv.total; remainingPool -= inv.total; }
                else { paid = remainingPool; remainingPool = 0; }
            }
            const date = new Date(inv.date || inv.invoiceDate);
            const ageDays = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
            return { 
                no: inv.invoiceNumber, 
                date: inv.date || inv.invoiceDate, 
                total: inv.total, 
                paid: paid, 
                remaining: inv.total - paid, 
                age: ageDays 
            };
        });

        return { balance: totalInv - totalPay, agingData, unpaidInvoices: agingData.filter(i => i.remaining > 0.01) };
    }

    function renderAllocationTable(id, type) {
        const isCust = type === 'customer';
        const container = isCust ? $('receiptAllocationContainer') : $('paymentAllocationContainer');
        const tbody = isCust ? $('receiptAllocationBody') : $('paymentAllocationBody');
        const fin = getEntityFinancials(id, type);
        
        tbody.innerHTML = '';
        if (fin.unpaidInvoices.length === 0) { container.style.display = 'none'; return; }
        
        container.style.display = 'block';
        fin.unpaidInvoices.forEach(inv => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${inv.no}</td>
                <td>${formatDate(inv.date)}</td>
                <td>${inv.total.toFixed(2)}</td>
                <td>${inv.remaining.toFixed(2)}</td>
                <td><input type="number" class="alloc-pay" max="${inv.remaining}" step="any" placeholder="0" aria-label="Payment"></td>
                <td><input type="number" class="alloc-disc" max="${inv.remaining}" step="any" placeholder="0" aria-label="Discount"></td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => updateAllocTotals(type));
        });
        updateAllocTotals(type);
    }

    function updateAllocTotals(type) {
        const isCust = type === 'customer';
        const tbody = isCust ? $('receiptAllocationBody') : $('paymentAllocationBody');
        let totalPay = 0, totalDisc = 0;

        tbody.querySelectorAll('tr').forEach(tr => {
            totalPay += num(tr.querySelector('.alloc-pay').value);
            totalDisc += num(tr.querySelector('.alloc-disc').value);
        });

        if (isCust) {
            if($('allocTotalPay')) $('allocTotalPay').innerText = totalPay.toFixed(2);
            if($('allocTotalDisc')) $('allocTotalDisc').innerText = totalDisc.toFixed(2);
            $('amountReceived').value = totalPay.toFixed(2);
        } else {
            if($('payAllocTotalPay')) $('payAllocTotalPay').innerText = totalPay.toFixed(2);
            if($('payAllocTotalDisc')) $('payAllocTotalDisc').innerText = totalDisc.toFixed(2);
            $('amountPaid').value = totalPay.toFixed(2);
        }
    }

    // ============================================================
    // 7. معالجة المدخلات (Handlers)
    // ============================================================
    function handleEntityInput(e, type) {
        const val = e.target.value;
        const listId = type==='customer' ? 'customersDatalist' : 'suppliersDatalist';
        const opt = Array.from($(listId).options).find(o => o.value === val);
        const boxId = e.target.id.includes('customer') ? (e.target.id.includes('receipt')?'receiptCustomerStatusBox':'customerStatusBox') : (e.target.id.includes('payment')?'paymentSupplierStatusBox':'supplierStatusBox');
        
        if(opt) {
            const code = opt.dataset.code;
            if(type==='customer' && e.target.id==='customerName') { 
                const c = customersDB.find(x=>x.id===code); 
                $('customerTaxNumber').value=c?.taxNumber||''; 
                $('invoiceDiscount').value=c?.discount||0; 
            }
            if(type==='supplier' && e.target.id==='supplierName') { 
                const s = suppliersDB.find(x=>x.id===code); 
                $('supplierTaxNumber').value=s?.taxNumber||''; 
                $('purchaseDiscount').value=s?.discount||0; 
            }

            if (e.target.id === 'receiptCustomerName' || e.target.id === 'paymentSupplierName') {
                renderAllocationTable(code, type);
            }
            
            const box = $(boxId);
            if(box) {
                 const fin = getEntityFinancials(code, type);
                 let h = `<h4>الرصيد: ${fin.balance.toFixed(2)}</h4>`;
                 if(fin.unpaidInvoices.length>0 && !e.target.id.includes('receipt') && !e.target.id.includes('payment')) {
                     h += `<div class="aging-table"><table><thead><tr><th>ف</th><th>قيمة</th><th>متبقي</th></tr></thead><tbody>`;
                     fin.unpaidInvoices.forEach(r => h += `<tr><td>${r.no}</td><td>${r.total}</td><td style="color:red">${r.remaining.toFixed(2)}</td></tr>`);
                     h += `</tbody></table></div>`;
                 }
                 box.innerHTML = h; box.style.display='block';
            }
        } else { 
            const box = $(boxId); if(box) box.style.display='none';
            if(e.target.id.includes('receipt')) { const el=$('receiptAllocationContainer'); if(el) el.style.display='none'; }
            if(e.target.id.includes('payment')) { const el=$('paymentAllocationContainer'); if(el) el.style.display='none'; }
        }
    }

    function renderLog(db, tableId, type) {
        const tbody = $(tableId).querySelector('tbody'); 
        tbody.innerHTML = '';
        db.forEach(item => {
            const id = item.id || item.invoiceNumber || item.receiptNumber || item.paymentNumber || item.code;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${id}</td><td>${formatDate(item.date||item.invoiceDate)}</td><td>${item.customerName||item.supplierName||item.name}</td><td>${item.grandTotal||item.amount}</td><td class="actions"><button class="btn warning small-action" onclick="editRec('${type}','${id}')">✎</button><button class="btn danger small-action" onclick="delRec('${type}','${id}')">🗑</button><button class="btn secondary small-action" onclick="printRec('${type}','${id}')">⎙</button></td>`;
            tbody.appendChild(tr);
        });
    }

    // ============================================================
    // 8. وظائف Window (للاستدعاء من HTML)
    // ============================================================
    window.calcSales=()=>{let sub=0;$('itemsBody').querySelectorAll('tr').forEach(r=>{const t=num(r.querySelector('.q').value)*num(r.querySelector('.p').value);r.querySelector('.t').innerText=t.toFixed(2);sub+=t;});const disc=num($('invoiceDiscount').value);const vat=(sub-disc)*0.15;$('subTotal').innerText=sub.toFixed(2);$('displayDiscount').innerText=disc.toFixed(2);$('vatTotal').innerText=vat.toFixed(2);$('grandTotal').innerText=((sub-disc)+vat).toFixed(2);};
    
    window.addSalesItem=(d='',q=1,p=0)=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td><input class="d" list="itemsDatalist" value="${d}" aria-label="Description"></td><td><input class="q" type="number" value="${q}" aria-label="Qty"></td><td><input class="p" type="number" value="${p}" aria-label="Price"></td><td class="t">0.00</td><td><button class="btn danger small-action" onclick="this.closest('tr').remove();calcSales()">x</button></td>`;
        $('itemsBody').appendChild(tr);
        tr.querySelectorAll('input').forEach(i=>i.addEventListener('input',window.calcSales));
        tr.querySelector('.d').addEventListener('input', function(){
            const it=itemsDB.find(x=>x.name===this.value);
            if(it){ tr.querySelector('.p').value=it.price; window.calcSales(); }
        });
        window.calcSales();
    };

    window.calcPur=()=>{let sub=0;$('purchaseItemsBody').querySelectorAll('tr').forEach(r=>{const t=num(r.querySelector('.q').value)*num(r.querySelector('.p').value);r.querySelector('.t').innerText=t.toFixed(2);sub+=t;});const disc=num($('purchaseDiscount').value);const vat=(sub-disc)*0.15;$('purchaseSubTotal').innerText=sub.toFixed(2);$('purchaseDisplayDiscount').innerText=disc.toFixed(2);$('purchaseVatTotal').innerText=vat.toFixed(2);$('purchaseGrandTotal').innerText=((sub-disc)+vat).toFixed(2);};
    
    window.addPurItem=(d='',q=1,p=0)=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td><input class="d" list="itemsDatalist" value="${d}" aria-label="Desc"></td><td><input class="q" type="number" value="${q}" aria-label="Qty"></td><td><input class="p" type="number" value="${p}" aria-label="Price"></td><td class="t">0.00</td><td><button class="btn danger small-action" onclick="this.closest('tr').remove();calcPur()">x</button></td>`;
        $('purchaseItemsBody').appendChild(tr);
        tr.querySelectorAll('input').forEach(i=>i.addEventListener('input',window.calcPur));
        tr.querySelector('.d').addEventListener('input', function(){
            const it=itemsDB.find(x=>x.name===this.value);
            if(it){ tr.querySelector('.p').value=it.price; window.calcPur(); }
        });
        window.calcPur();
    };

    window.addDiscount = (type, id) => {
        const isCust = type === 'customer';
        const ent = isCust ? customersDB.find(x => x.id === id) : suppliersDB.find(x => x.id === id);
        const amount = prompt(`أدخل قيمة الخصم لـ ${ent.name}:`);
        if (!amount || isNaN(amount) || amount <= 0) return;
        const desc = prompt("سبب الخصم:", "خصم تسوية");

        if (isCust) {
            receiptsDB.push({receiptNumber: getNextId(receiptsDB, 'receiptNumber', 'DISC'), date: new Date().toISOString(), customerCode: id, customerName: ent.name, amount: num(amount), paymentMethod: 'Discount', description: desc || 'خصم'});
        } else {
            paymentVouchersDB.push({paymentNumber: getNextId(paymentVouchersDB, 'paymentNumber', 'PDISC'), date: new Date().toISOString(), supplierCode: id, supplierName: ent.name, amount: num(amount), paymentMethod: 'Discount', description: desc || 'خصم'});
        }
        saveData(); renderAll(); alert('تم إضافة الخصم');
    };

    window.printRec = (type, id) => {
        const logoHtml = sellerInfo.logo ? `<img src="${sellerInfo.logo}">` : '';
        document.querySelectorAll('.logo-container').forEach(l => l.innerHTML = logoHtml);

        if(type==='invoice') {
            const d = invoicesDB.find(x=>x.invoiceNumber===id);
            const c = customersDB.find(x=>x.id===d.customerCode);
            $('invoiceTitle').innerText='فاتورة ضريبية'; $('previewInvoiceNo').innerText=d.invoiceNumber; $('previewDate').innerText=formatDate(d.invoiceDate);
            $('previewSellerName').innerText=sellerInfo.name; $('previewSellerInfo').innerText=`${sellerInfo.address} - ${sellerInfo.taxNumber}`;
            $('previewClient').innerHTML=`<div><strong>العميل:</strong> ${d.customerName}</div><div><strong>الرقم الضريبي:</strong> ${c?c.taxNumber:''}</div>`;
            let h=`<table class="items-table"><thead><tr><th>صنف</th><th>كمية</th><th>سعر</th><th>إجمالي</th></tr></thead><tbody>`;
            d.items.forEach(i=>h+=`<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.price}</td><td>${i.total}</td></tr>`);
            $('previewItems').innerHTML=h+`</tbody></table>`;
            $('previewTotals').innerHTML=`<div style="text-align:left;width:50%"><div>المجموع: ${d.subTotal}</div><div>الخصم: ${num(d.discount).toFixed(2)}</div><div>الضريبة: ${d.vatTotal}</div><h3>الصافي: ${d.grandTotal}</h3></div>`;
            
            function generateTLV(tag, value) {
                const len = new TextEncoder().encode(value).length;
                const lenHex = len.toString(16).padStart(2, '0');
                const tagHex = tag.toString(16).padStart(2, '0');
                return tagHex + lenHex + Array.from(new TextEncoder().encode(value)).map(c => c.toString(16).padStart(2, '0')).join('');
            }
            function generateZatcaQr(seller, tax, date, total, vat) {
                let tlv = generateTLV(1, seller) + generateTLV(2, tax) + generateTLV(3, date) + generateTLV(4, total) + generateTLV(5, vat);
                return btoa(tlv.match(/\w{2}/g).map(a => String.fromCharCode(parseInt(a, 16))).join(""));
            }
            
            $('qrContainer').innerHTML=''; new QRCode($('qrContainer'),{text:generateZatcaQr(sellerInfo.name, sellerInfo.taxNumber, d.invoiceDate, d.grandTotal, d.vatTotal),width:140,height:140});
            document.body.className='printing-invoice';
        } 
        else if (type==='receipt' || type==='payment') {
            const isPay=type==='payment'; const db=isPay?paymentVouchersDB:receiptsDB; const key=isPay?'paymentNumber':'receiptNumber'; const d=db.find(x=>x[key]===id);
            $('receiptDocTitle').innerText=isPay?'سند صرف':'سند تحصيل'; $('receiptPreviewSellerName').innerText=sellerInfo.name; $('receiptPreviewNumber').innerText=d[key]; $('receiptPreviewDate').innerText=formatDate(d.date);
            $('lblRecFromTo').innerText=isPay?'يصرف لـ:':'استلمنا من:'; $('receiptPreviewCustomer').innerText=isPay?d.supplierName:d.customerName; $('receiptPreviewAmount').innerText=num(d.amount).toFixed(2); $('receiptPreviewDesc').innerText=d.description; $('receiptPreviewPayment').innerText=d.paymentMethod;
            document.body.className='printing-receipt';
        }
        window.print();
    };

    window.printStatement = (type, id) => {
        const isCust = type==='customer'; const ent = isCust ? customersDB.find(x=>x.id===id) : suppliersDB.find(x=>x.id===id); if(!ent) return;
        let txs = [];
        if(isCust) { txs = [...invoicesDB.filter(i=>i.customerCode===id).map(i=>({d:i.invoiceDate, ref:i.invoiceNumber, type:'فاتورة', db:num(i.grandTotal), cr:0})), ...receiptsDB.filter(r=>r.customerCode===id).map(r=>({d:r.date, ref:r.receiptNumber, type:'سند قبض', db:0, cr:num(r.amount)}))]; } 
        else { txs = [...purchaseInvoicesDB.filter(i=>i.supplierCode===id).map(i=>({d:i.date, ref:i.invoiceNumber, type:'فاتورة شراء', db:0, cr:num(i.grandTotal)})), ...paymentVouchersDB.filter(p=>p.supplierCode===id).map(p=>({d:p.date, ref:p.paymentNumber, type:'سند صرف', db:num(p.amount), cr:0}))]; }
        txs.sort((a,b) => new Date(a.d) - new Date(b.d));
        let html = '', bal = 0;
        txs.forEach(t => { bal += t.db - t.cr; html += `<tr><td>${formatDate(t.d)}</td><td>${t.type} - ${t.ref}</td><td>${t.db?t.db.toFixed(2):'-'}</td><td>${t.cr?t.cr.toFixed(2):'-'}</td><td>${bal.toFixed(2)}</td></tr>`; });
        $('stmtTitle').innerText = isCust ? 'كشف حساب عميل' : 'كشف حساب مورد'; $('stmtSellerName').innerText = sellerInfo.name; if(sellerInfo.logo) $('stmtLogo').innerHTML = `<img src="${sellerInfo.logo}">`;
        $('stmtClientInfo').innerHTML = `<strong>الاسم:</strong> ${ent.name} <br> <strong>الكود:</strong> ${ent.id}`; $('stmtBody').innerHTML = html; $('stmtSummary').innerHTML = `الرصيد: ${bal.toFixed(2)}`;
        document.body.className = 'printing-statement'; window.print();
    };

    window.editRec = (type, id) => {
        if(type==='invoice') { const x=invoicesDB.find(i=>i.invoiceNumber===id); editingInvoiceId=id; $('invoiceNumber').value=x.invoiceNumber; $('invoiceDate').value=toLocal(new Date(x.invoiceDate)); $('customerName').value=x.customerName; $('invoiceDiscount').value=x.discount||0; $('itemsBody').innerHTML=''; x.items.forEach(i=>addSalesItem(i.description,i.quantity,i.price)); handleEntityInput({target:$('customerName')},'customer'); document.querySelector('[data-tab="salesTab"]').click(); document.querySelector('[data-tab="createInvoice"]').click(); }
        else if (type==='receipt') { const x=receiptsDB.find(r=>r.receiptNumber===id); editingReceiptId=id; $('receiptNumber').value=x.receiptNumber; $('receiptDate').value=toLocal(new Date(x.date)); $('receiptCustomerName').value=x.customerName; $('amountReceived').value=x.amount; $('receiptDescription').value=x.description; document.querySelector('[data-tab="salesTab"]').click(); document.querySelector('[data-tab="createReceipt"]').click(); }
    };
    window.delRec = (type, id) => { if(!confirm('حذف؟')) return; if(type==='invoice') invoicesDB=invoicesDB.filter(x=>x.invoiceNumber!==id); else if(type==='receipt') receiptsDB=receiptsDB.filter(x=>x.receiptNumber!==id); else if(type==='purchase') purchaseInvoicesDB=purchaseInvoicesDB.filter(x=>x.invoiceNumber!==id); else if(type==='payment') paymentVouchersDB=paymentVouchersDB.filter(x=>x.paymentNumber!==id); else if(type==='customer') customersDB=customersDB.filter(x=>x.id!==id); else if(type==='supplier') suppliersDB=suppliersDB.filter(x=>x.id!==id); else if(type==='item') itemsDB.splice(id,1); saveData(); renderAll(); };

    // ============================================================
    // 9. الحفظ (Save Logic)
    // ============================================================
    function saveInvoice(){
        const cOpt=Array.from($('customersDatalist').options).find(o=>o.value===$('customerName').value); if(!cOpt) return alert('عميل خطأ');
        const items=Array.from($('itemsBody').querySelectorAll('tr')).map(r=>({description:r.querySelector('.d').value,quantity:r.querySelector('.q').value,price:r.querySelector('.p').value,total:r.querySelector('.t').innerText}));
        const obj={invoiceNumber:$('invoiceNumber').value||getNextId(invoicesDB,'invoiceNumber','INV'),invoiceDate:new Date($('invoiceDate').value).toISOString(),customerCode:cOpt.dataset.code,customerName:$('customerName').value,discount:num($('invoiceDiscount').value),subTotal:$('subTotal').innerText,vatTotal:$('vatTotal').innerText,grandTotal:$('grandTotal').innerText,items:items};
        if(editingInvoiceId)invoicesDB=invoicesDB.map(x=>x.invoiceNumber===editingInvoiceId?obj:x);else invoicesDB.push(obj);
        saveData();resetSalesForm();renderAll();
    }
    
    function saveReceipt() {
        const cName = $('receiptCustomerName').value;
        const cOpt = Array.from($('customersDatalist').options).find(o => o.value === cName);
        if (!cOpt) return alert('عميل غير صحيح');
        
        const payAmount = num($('amountReceived').value);
        const discAmount = num($('allocTotalDisc').innerText);
        
        if (payAmount > 0) {
            const obj = { receiptNumber: $('receiptNumber').value || getNextId(receiptsDB, 'receiptNumber', 'REC'), date: new Date($('receiptDate').value).toISOString(), customerCode: cOpt.dataset.code, customerName: cName, amount: payAmount, paymentMethod: $('paymentMethod').value, description: $('receiptDescription').value };
            if(editingReceiptId) receiptsDB = receiptsDB.map(x=>x.receiptNumber===editingReceiptId?obj:x); else receiptsDB.push(obj);
        }
        if (discAmount > 0) {
             receiptsDB.push({ receiptNumber: getNextId(receiptsDB, 'receiptNumber', 'DISC'), date: new Date($('receiptDate').value).toISOString(), customerCode: cOpt.dataset.code, customerName: cName, amount: discAmount, paymentMethod: 'Discount', description: 'خصم عند السداد' });
        }
        saveData(); resetReceiptForm(); renderAll();
    }
    
    function savePurchase(){
        const sOpt=Array.from($('suppliersDatalist').options).find(o=>o.value===$('supplierName').value);if(!sOpt)return alert('مورد خطأ');
        const items=Array.from($('purchaseItemsBody').querySelectorAll('tr')).map(r=>({description:r.querySelector('.d').value,quantity:r.querySelector('.q').value,price:r.querySelector('.p').value,total:r.querySelector('.t').innerText}));
        const obj={invoiceNumber:$('purchaseNumber').value||getNextId(purchaseInvoicesDB,'invoiceNumber','PINV'),date:new Date($('purchaseDate').value).toISOString(),supplierCode:sOpt.dataset.code,supplierName:$('supplierName').value,discount:num($('purchaseDiscount').value),subTotal:$('purchaseSubTotal').innerText,vatTotal:$('purchaseVatTotal').innerText,grandTotal:$('purchaseGrandTotal').innerText,items:items};
        if(editingPurchaseId)purchaseInvoicesDB=purchaseInvoicesDB.map(x=>x.invoiceNumber===editingPurchaseId?obj:x);else purchaseInvoicesDB.push(obj);
        saveData();resetPurchaseForm();renderAll();
    }

    function savePayment() {
        const sName = $('paymentSupplierName').value;
        const sOpt = Array.from($('suppliersDatalist').options).find(o => o.value === sName);
        if (!sOpt) return alert('مورد غير صحيح');
        const payAmount = num($('amountPaid').value);
        const discAmount = num($('payAllocTotalDisc').innerText);
        if (payAmount > 0) {
             const obj = { paymentNumber: $('paymentNumber').value || getNextId(paymentVouchersDB, 'paymentNumber', 'PAY'), date: new Date($('paymentDate').value).toISOString(), supplierCode: sOpt.dataset.code, supplierName: sName, amount: payAmount, paymentMethod: $('paymentPayMethod').value, description: $('paymentDescription').value };
            if(editingPaymentId) paymentVouchersDB = paymentVouchersDB.map(x=>x.paymentNumber===editingPaymentId?obj:x); else paymentVouchersDB.push(obj);
        }
        if (discAmount > 0) {
            paymentVouchersDB.push({ paymentNumber: getNextId(paymentVouchersDB, 'paymentNumber', 'PDISC'), date: new Date($('paymentDate').value).toISOString(), supplierCode: sOpt.dataset.code, supplierName: sName, amount: discAmount, paymentMethod: 'Discount', description: 'خصم مكتسب عند السداد' });
        }
        saveData(); resetPaymentForm(); renderAll();
    }

    function runReport() {
        const type=$('reportTypeSelector').value; 
        const from=$('reportFromDate').value?new Date($('reportFromDate').value):null; 
        const to=$('reportToDate').value?new Date($('reportToDate').value):null; 
        if(to) to.setHours(23,59,59);
        const fD=d=>(!from||new Date(d)>=from)&&(!to||new Date(d)<=to);

        let html = '';
        let exportData = [];

        if (type === 'custBalances' || type === 'supBalances') {
            const isCust = type === 'custBalances';
            const entities = isCust ? customersDB : suppliersDB;
            const entType = isCust ? 'customer' : 'supplier';
            html += `<table class="report-table"><thead><tr><th>العميل/المورد</th><th>رقم الفاتورة</th><th>التاريخ</th><th>الإجمالي</th><th>المسدد</th><th>المتبقي</th><th>عمر الدين (يوم)</th></tr></thead><tbody>`;
            entities.forEach(ent => {
                const fin = getEntityFinancials(ent.id, entType);
                if (fin.agingData.length > 0) {
                    fin.agingData.forEach(inv => {
                        html += `<tr><td>${ent.name} (${ent.id})</td><td>${inv.no}</td><td>${formatDate(inv.date)}</td><td>${inv.total.toFixed(2)}</td><td>${inv.paid.toFixed(2)}</td><td style="font-weight:bold">${inv.remaining.toFixed(2)}</td><td>${inv.age}</td></tr>`;
                        exportData.push({Entity: `${ent.name}`, Invoice: inv.no, Total: inv.total, Remaining: inv.remaining});
                    });
                }
            });
            html += `</tbody></table>`;
        }
        else if (type === 'collections' || type === 'payments') {
            const isCol = type === 'collections';
            const db = isCol ? receiptsDB : paymentVouchersDB;
            const data = db.filter(x => fD(x.date));
            let totalCash=0, totalBank=0, totalPOS=0, totalCheck=0;
            
            html += `<table class="report-table"><thead><tr><th>السند</th><th>التاريخ</th><th>${isCol?'العميل':'المورد'}</th><th>الطريقة</th><th>المبلغ</th></tr></thead><tbody>`;
            data.forEach(x => {
                const amt = num(x.amount);
                const m = x.paymentMethod;
                if(m==='Cash') totalCash+=amt; else if(m==='Bank Transfer') totalBank+=amt; else if(m==='POS') totalPOS+=amt; else totalCheck+=amt;
                html += `<tr><td>${isCol?x.receiptNumber:x.paymentNumber}</td><td>${formatDate(x.date)}</td><td>${isCol?x.customerName:x.supplierName}</td><td>${m}</td><td>${amt.toFixed(2)}</td></tr>`;
                exportData.push({Ref:isCol?x.receiptNumber:x.paymentNumber, Date:formatDate(x.date), Entity:isCol?x.customerName:x.supplierName, Method:m, Amount:amt});
            });
            html += `</tbody></table>`;
            html += `<table class="report-summary-table"><tr><th>نقدي</th><th>بنك</th><th>نقاط بيع</th><th>شيك</th><th>الإجمالي</th></tr><tr><td>${totalCash.toFixed(2)}</td><td>${totalBank.toFixed(2)}</td><td>${totalPOS.toFixed(2)}</td><td>${totalCheck.toFixed(2)}</td><td><strong>${(totalCash+totalBank+totalPOS+totalCheck).toFixed(2)}</strong></td></tr></table>`;
        }
        else {
            let data = [];
            if(type==='sales') data=invoicesDB.filter(x=>fD(x.invoiceDate)).map(x=>({No:x.invoiceNumber,Date:formatDate(x.invoiceDate),Client:x.customerName,Total:x.grandTotal}));
            else data=purchaseInvoicesDB.filter(x=>fD(x.date)).map(x=>({No:x.invoiceNumber,Date:formatDate(x.date),Supplier:x.supplierName,Total:x.grandTotal}));
            
            html += `<table class="report-table"><thead><tr>`;
            if(data.length>0) Object.keys(data[0]).forEach(k=>html+=`<th>${k}</th>`); 
            html+=`</tr></thead><tbody>`;
            data.forEach(r=>{html+=`<tr>`;Object.values(r).forEach(v=>html+=`<td>${v}</td>`);html+=`</tr>`});
            html+=`</tbody></table>`;
            exportData=data;
        }

        currentReportData = exportData;
        $('reportResultArea').innerHTML = html;
        $('reportPrintContent').innerHTML = html;
        if(sellerInfo.logo) $('reportLogo').innerHTML = `<img src="${sellerInfo.logo}">`;
        $('reportHeaderCompany').innerText = sellerInfo.name;
        $('reportHeaderTitle').innerText = $('reportTypeSelector').options[$('reportTypeSelector').selectedIndex].text;
    }

    // ============================================================
    // 10. المستمعات (Event Listeners)
    // ============================================================
    $('customerName').addEventListener('input', e=>handleEntityInput(e,'customer'));
    $('receiptCustomerName').addEventListener('input', e=>handleEntityInput(e,'customer'));
    $('supplierName').addEventListener('input', e=>handleEntityInput(e,'supplier'));
    $('paymentSupplierName').addEventListener('input', e=>handleEntityInput(e,'supplier'));
    
    // Buttons
    $('newInvoiceBtn').addEventListener('click',resetSalesForm); $('generateBtn').addEventListener('click',saveInvoice); $('addItemBtn').addEventListener('click',()=>window.addSalesItem());
    $('newReceiptBtn').addEventListener('click',resetReceiptForm); $('saveReceiptBtn').addEventListener('click',saveReceipt);
    $('newPurchaseBtn').addEventListener('click',resetPurchaseForm); $('savePurchaseBtn').addEventListener('click',savePurchase); $('addPurchaseItemBtn').addEventListener('click',()=>window.addPurItem());
    $('newPaymentBtn').addEventListener('click',resetPaymentForm); $('savePaymentBtn').addEventListener('click',savePayment); 
    $('runReportBtn').addEventListener('click', runReport);
    $('printReportBtn').addEventListener('click', ()=>{if(!currentReportData)return alert('لا يوجد تقرير');document.body.className='printing-report';window.print();});
    $('exportExcelBtn').addEventListener('click', ()=>{if(!currentReportData)return alert('لا يوجد بيانات');const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(currentReportData),"Report");XLSX.writeFile(wb,"Report.xlsx");});
    
    // SAVE CUSTOMER / SUPPLIER / ITEM (Added these missing listeners)
    $('saveCustomerBtn').addEventListener('click', () => {
        const id = $('custCode').value || getNextId(customersDB, 'id', 'CUST');
        const obj = { id, name: $('custName').value, taxNumber: $('custTaxNumber').value, phone: $('custPhone').value, city: $('custCity').value, discount: num($('custDiscount').value) };
        customersDB = customersDB.filter(x => x.id !== id); customersDB.push(obj); saveData(); renderAll(); $('custCode').value = ''; $('custName').value = ''; $('custDiscount').value = '';
    });
    $('saveSupplierBtn').addEventListener('click', () => {
        const id = $('supId').value || getNextId(suppliersDB, 'id', 'SUP');
        const obj = { id, name: $('supName').value, taxNumber: $('supTax').value, phone: $('supPhone').value, discount: num($('supDiscount').value) };
        suppliersDB = suppliersDB.filter(x => x.id !== id); suppliersDB.push(obj); saveData(); renderAll(); $('supId').value = ''; $('supName').value = ''; $('supDiscount').value = '';
    });
    $('saveItemBtn').addEventListener('click', () => {
        itemsDB.push({ name: $('itemName').value, price: num($('itemPrice').value) }); saveData(); renderAll(); $('itemName').value = '';
    });

    $('saveSettingsBtn').addEventListener('click', () => {
        sellerInfo.name = $('settingSellerName').value; sellerInfo.taxNumber = $('settingSellerTaxNum').value; sellerInfo.address = $('settingSellerAddress').value; sellerInfo.phone = $('settingSellerPhone').value; saveData(); alert('تم حفظ الإعدادات');
    });
    $('logoUpload').addEventListener('change', function(){const f=this.files[0]; if(f){const r=new FileReader(); r.onload=e=>{sellerInfo.logo=e.target.result; $('logoPreview').src=sellerInfo.logo; $('logoPreview').style.display='block';}; r.readAsDataURL(f);}});

    $('langToggleBtn').addEventListener('click', () => setLanguage(currentLang==='ar'?'en':'ar'));
    $('logoutBtn').addEventListener('click', () => { sessionStorage.removeItem('loggedInUser'); window.location.href='index.html'; });

    $('clearCustomerFormBtn').addEventListener('click',()=>{$('custCode').value='';$('custName').value='';$('custDiscount').value='';}); 
    $('clearSupplierBtn').addEventListener('click',()=>{$('supId').value='';$('supName').value='';$('supDiscount').value='';});
    
    document.body.addEventListener('afterprint', ()=>{ document.body.className=''; document.querySelectorAll('.preview, .statement-preview, .report-preview').forEach(p=>p.style.display='none'); });

    document.querySelectorAll('.tab-btn, .sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const isMain=btn.classList.contains('tab-btn'); if(isMain) document.querySelectorAll('.preview').forEach(p=>p.style.display='none');
            const parent=isMain?'.tabs-nav':`[data-parent="${btn.dataset.parent}"]`;
            if(isMain) document.querySelectorAll('.tabs-nav .tab-btn').forEach(b=>b.classList.remove('active')); else document.getElementById(btn.dataset.parent).querySelectorAll('.sub-tab-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll(isMain?'.tab-content':'.sub-tab-content').forEach(d=>d.classList.remove('active')); $(btn.dataset.tab).classList.add('active');
        });
    });

    // ============================================================
    // 11. التشغيل الأولي (Initialization)
    // ============================================================
    loadData();
    resetSalesForm(); resetReceiptForm(); resetPurchaseForm(); resetPaymentForm();
    setLanguage('ar');
});
