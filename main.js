/* --- START OF FILE main.js --- */

document.addEventListener('DOMContentLoaded', function() {

    // Auth Check
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (!loggedInUser) { window.location.href = 'index.html'; return; }

    // --- State & DB ---
    let invoicesDB = [], receiptsDB = [], itemsDB = [], customersDB = [], suppliersDB = [], purchasesDB = [], sellerInfo = {};
    let currentLang = 'ar';
    let editingInvoiceId = null, editingReceiptId = null, editingItemId = null, editingCustomerId = null, editingSupplierId = null;

    const defaultSellerInfo = { name: "اسم الشركة", taxNumber: "", address: "", phone: "", logo: "" };

    // Helpers
    const $ = id => document.getElementById(id);
    const toLocalISO = (d) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '';
    const formatMoney = (n) => parseFloat(n || 0).toFixed(2);
    
    // --- Local Storage ---
    function saveAllData() {
        const data = { invoicesDB, receiptsDB, itemsDB, customersDB, suppliersDB, purchasesDB, sellerInfo };
        localStorage.setItem(`accData_${loggedInUser}`, JSON.stringify(data));
    }
    
    function loadAllData() {
        const raw = localStorage.getItem(`accData_${loggedInUser}`);
        if (raw) {
            const d = JSON.parse(raw);
            invoicesDB = d.invoicesDB || [];
            receiptsDB = d.receiptsDB || [];
            itemsDB = d.itemsDB || [];
            customersDB = d.customersDB || [];
            suppliersDB = d.suppliersDB || [];
            purchasesDB = d.purchasesDB || [];
            sellerInfo = d.sellerInfo || defaultSellerInfo;
        } else {
            sellerInfo = defaultSellerInfo;
        }
        if(sellerInfo.logo) $('logoPreview').src = sellerInfo.logo;
    }

    // --- Core Logic functions ---
    
    // Calculations
    const getCustomerBalance = (id) => {
        const sales = invoicesDB.filter(i => i.customerCode == id).reduce((a, b) => a + parseFloat(b.grandTotal), 0);
        const collected = receiptsDB.filter(r => r.customerCode == id).reduce((a, b) => a + parseFloat(b.amount), 0);
        return formatMoney(sales - collected);
    };
    const getSupplierBalance = (id) => {
        const bought = purchasesDB.filter(p => p.supplierCode == id).reduce((a, b) => a + parseFloat(b.grandTotal), 0);
        // Assuming no "Payment to Supplier" module yet, balance is total purchases. 
        // Real app would need Payment Vouchers.
        return formatMoney(bought);
    };
    const getItemSoldQty = (name) => invoicesDB.reduce((acc, inv) => acc + inv.items.filter(i => i.description === name).reduce((s, it) => s + parseFloat(it.quantity), 0), 0);
    const getItemPurchasedQty = (name) => purchasesDB.reduce((acc, pur) => acc + pur.items.filter(i => i.description === name).reduce((s, it) => s + parseFloat(it.quantity), 0), 0);

    // --- DOM Renderers ---

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
        const custDL = $('customersDatalist'); custDL.innerHTML = '';
        customersDB.forEach(c => custDL.innerHTML += `<option value="${c.name}" data-code="${c.id}">`);
        
        const supDL = $('suppliersDatalist'); supDL.innerHTML = '';
        suppliersDB.forEach(s => supDL.innerHTML += `<option value="${s.name}" data-code="${s.id}">`);

        const itemDL = $('itemsDatalist'); itemDL.innerHTML = '';
        itemsDB.forEach(i => itemDL.innerHTML += `<option value="${i.name}" data-price="${i.price}">`);
    }

    // 1. Invoices
    function renderInvoiceLog() {
        const tbody = $('invoiceLogBody'); tbody.innerHTML = '';
        invoicesDB.slice().reverse().forEach(inv => {
            tbody.innerHTML += `<tr><td>${inv.invoiceNumber}</td><td>${formatDate(inv.invoiceDate)}</td><td>${inv.customerName}</td><td>${inv.grandTotal}</td>
            <td class="actions"><button class="btn warning small-action" onclick="editInvoice('${inv.invoiceNumber}')">تعديل</button><button class="btn secondary small-action" onclick="printInvoice('${inv.invoiceNumber}')">طباعة</button></td></tr>`;
        });
    }

    // 2. Receipts
    function renderReceiptLog() {
        const tbody = $('receiptLogBody'); tbody.innerHTML = '';
        receiptsDB.slice().reverse().forEach(r => {
            tbody.innerHTML += `<tr><td>${r.receiptNumber}</td><td>${formatDate(r.date)}</td><td>${r.customerName}</td><td>${formatMoney(r.amount)}</td>
            <td class="actions"><button class="btn warning small-action" onclick="editReceipt('${r.receiptNumber}')">تعديل</button><button class="btn secondary small-action" onclick="printReceipt('${r.receiptNumber}')">طباعة</button></td></tr>`;
        });
    }

    // 3. Items
    function renderItemsLog() {
        const tbody = $('itemsLogBody'); tbody.innerHTML = '';
        itemsDB.forEach((item, idx) => {
            tbody.innerHTML += `<tr><td>${item.name}</td><td>${item.price}</td><td>${getItemSoldQty(item.name)}</td>
            <td class="actions"><button class="btn warning small-action" onclick="editItem(${idx})">تعديل</button><button class="btn danger small-action" onclick="deleteItem(${idx})">حذف</button></td></tr>`;
        });
    }

    // 4. Customers
    function renderCustomersLog() {
        const tbody = $('customersLogBody'); tbody.innerHTML = '';
        customersDB.forEach(c => {
            tbody.innerHTML += `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.phone}</td><td>${getCustomerBalance(c.id)}</td>
            <td class="actions"><button class="btn warning small-action" onclick="editCustomer('${c.id}')">تعديل</button><button class="btn info small-action" onclick="printStatement('${c.id}', 'customer')">كشف</button></td></tr>`;
        });
    }

    // 5. Suppliers
    function renderSuppliersLog() {
        const tbody = $('suppliersLogBody'); tbody.innerHTML = '';
        suppliersDB.forEach(s => {
            tbody.innerHTML += `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.phone}</td><td>${getSupplierBalance(s.id)}</td>
            <td class="actions"><button class="btn warning small-action" onclick="editSupplier('${s.id}')">تعديل</button><button class="btn info small-action" onclick="printStatement('${s.id}', 'supplier')">كشف</button></td></tr>`;
        });
    }

    // 6. Purchases
    function renderPurchaseLog() {
        const tbody = $('purchaseLogBody'); tbody.innerHTML = '';
        purchasesDB.slice().reverse().forEach(p => {
            tbody.innerHTML += `<tr><td>${p.invoiceNumber}</td><td>${formatDate(p.invoiceDate)}</td><td>${p.supplierName}</td><td>${p.grandTotal}</td>
            <td class="actions"><button class="btn warning small-action" onclick="alert('التعديل غير متاح حاليا للحفاظ على دقة المخزون')">عرض</button></td></tr>`;
        });
    }


    // --- Actions & Saves ---

    // Invoice Logic
    window.addItem = (desc='', qty=1, price=0) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input class="itm-desc" value="${desc}" list="itemsDatalist"></td><td><input class="itm-qty" type="number" value="${qty}"></td><td><input class="itm-price" type="number" value="${price}"></td><td class="itm-total">0.00</td><td><button class="btn danger small-action" onclick="this.closest('tr').remove();calcInvoice();">x</button></td>`;
        $('itemsBody').appendChild(tr);
        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', calcInvoice));
        tr.querySelector('.itm-desc').addEventListener('change', function(){
           const opt = Array.from($('itemsDatalist').options).find(o=>o.value===this.value);
           if(opt) tr.querySelector('.itm-price').value = opt.dataset.price;
           calcInvoice();
        });
        calcInvoice();
    };
    function calcInvoice(){
        let sub = 0;
        document.querySelectorAll('#itemsBody tr').forEach(row => {
            const q = parseFloat(row.querySelector('.itm-qty').value)||0;
            const p = parseFloat(row.querySelector('.itm-price').value)||0;
            const t = q*p;
            row.querySelector('.itm-total').innerText = formatMoney(t);
            sub += t;
        });
        const vat = sub * 0.15;
        $('subTotal').innerText = formatMoney(sub);
        $('vatTotal').innerText = formatMoney(vat);
        $('grandTotal').innerText = formatMoney(sub + vat);
    }
    $('newInvoiceBtn').onclick = () => { editingInvoiceId=null; $('invoiceNumber').value=''; $('invoiceDate').value=toLocalISO(new Date()); $('itemsBody').innerHTML=''; addItem(); calcInvoice(); };
    $('generateBtn').onclick = () => {
        const custName = $('customerName').value;
        const custOpt = Array.from($('customersDatalist').options).find(o=>o.value===custName);
        if(!custOpt) return alert('اختر عميلاً صحيحاً');
        
        const data = {
            invoiceNumber: $('invoiceNumber').value || `INV-${Date.now()}`,
            invoiceDate: $('invoiceDate').value,
            customerCode: custOpt.dataset.code, customerName: custName,
            subTotal: $('subTotal').innerText, vatTotal: $('vatTotal').innerText, grandTotal: $('grandTotal').innerText,
            items: Array.from(document.querySelectorAll('#itemsBody tr')).map(r => ({
                description: r.querySelector('.itm-desc').value, quantity: r.querySelector('.itm-qty').value, price: r.querySelector('.itm-price').value, total: r.querySelector('.itm-total').innerText
            }))
        };
        
        if(editingInvoiceId) {
            const idx = invoicesDB.findIndex(i=>i.invoiceNumber===editingInvoiceId);
            invoicesDB[idx] = data;
        } else { invoicesDB.push(data); }
        
        saveAllData(); renderAllLogs(); $('newInvoiceBtn').click();
    };

    // Purchase Logic
    window.addPurchaseItem = () => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input class="p-desc" list="itemsDatalist"></td><td><input class="p-qty" type="number" value="1"></td><td><input class="p-cost" type="number" value="0"></td><td class="p-total">0.00</td><td><button class="btn danger small-action" onclick="this.closest('tr').remove();calcPurchase();">x</button></td>`;
        $('purchaseItemsBody').appendChild(tr);
        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', calcPurchase));
    };
    function calcPurchase(){
        let sub = 0;
        document.querySelectorAll('#purchaseItemsBody tr').forEach(row => {
            const q = parseFloat(row.querySelector('.p-qty').value)||0;
            const c = parseFloat(row.querySelector('.p-cost').value)||0;
            const t = q*c;
            row.querySelector('.p-total').innerText = formatMoney(t);
            sub += t;
        });
        const vat = sub * 0.15;
        $('purchaseSubTotal').innerText = formatMoney(sub);
        $('purchaseVatTotal').innerText = formatMoney(vat);
        $('purchaseGrandTotal').innerText = formatMoney(sub + vat);
    }
    $('addPurchaseItemBtn').onclick = addPurchaseItem;
    $('newPurchaseBtn').onclick = () => { $('purchaseNumber').value=''; $('purchaseDate').value=toLocalISO(new Date()); $('purchaseItemsBody').innerHTML=''; addPurchaseItem(); };
    $('savePurchaseBtn').onclick = () => {
        const supName = $('supplierName').value;
        const supOpt = Array.from($('suppliersDatalist').options).find(o=>o.value===supName);
        if(!supOpt) return alert('اختر مورداً صحيحاً');

        const data = {
            invoiceNumber: $('purchaseNumber').value || `PUR-${Date.now()}`,
            invoiceDate: $('purchaseDate').value,
            supplierCode: supOpt.dataset.code, supplierName: supName,
            grandTotal: $('purchaseGrandTotal').innerText,
            items: Array.from(document.querySelectorAll('#purchaseItemsBody tr')).map(r => ({
                description: r.querySelector('.p-desc').value, quantity: r.querySelector('.p-qty').value
            }))
        };
        purchasesDB.push(data);
        saveAllData(); renderAllLogs(); $('newPurchaseBtn').click();
    };

    // Customer/Supplier Logic
    $('saveCustomerBtn').onclick = () => {
        const data = { id: $('custCode').value, name: $('custName').value, taxNumber: $('custTaxNumber').value, phone: $('custPhone').value, address: $('custAddress').value };
        if(!data.id || !data.name) return alert('الكود والاسم مطلوبان');
        const idx = customersDB.findIndex(c=>c.id===data.id);
        if(idx > -1) customersDB[idx] = data; else customersDB.push(data);
        saveAllData(); renderAllLogs(); $('clearCustomerFormBtn').click();
    };
    $('clearCustomerFormBtn').onclick = () => { $('custCode').value=''; $('custName').value=''; $('custTaxNumber').value=''; $('custPhone').value=''; $('custAddress').value=''; };

    $('saveSupplierBtn').onclick = () => {
        const data = { id: $('supCode').value, name: $('supName').value, taxNumber: $('supTaxNumber').value, phone: $('supPhone').value };
        if(!data.id || !data.name) return alert('الكود والاسم مطلوبان');
        const idx = suppliersDB.findIndex(s=>s.id===data.id);
        if(idx > -1) suppliersDB[idx] = data; else suppliersDB.push(data);
        saveAllData(); renderAllLogs(); $('clearSupplierFormBtn').click();
    };
    $('clearSupplierFormBtn').onclick = () => { $('supCode').value=''; $('supName').value=''; $('supTaxNumber').value=''; $('supPhone').value=''; };

    // Item Logic
    $('saveItemBtn').onclick = () => {
        const name = $('itemName').value; const price = $('itemPrice').value;
        if(!name) return;
        if(editingItemId!==null) itemsDB[editingItemId] = {name, price}; else itemsDB.push({name, price});
        saveAllData(); renderAllLogs(); $('clearItemFormBtn').click();
    };
    $('clearItemFormBtn').onclick = () => { editingItemId=null; $('itemName').value=''; $('itemPrice').value=''; };

    // Receipt Logic
    $('saveReceiptBtn').onclick = () => {
        const custName = $('receiptCustomerName').value;
        const custOpt = Array.from($('customersDatalist').options).find(o=>o.value===custName);
        if(!custOpt) return alert('اختر عميلاً');
        const data = {
            receiptNumber: $('receiptNumber').value || `REC-${Date.now()}`, date: $('receiptDate').value,
            customerCode: custOpt.dataset.code, customerName: custName,
            amount: $('amountReceived').value, paymentMethod: $('paymentMethod').value, description: $('receiptDescription').value
        };
        if(editingReceiptId) receiptsDB[receiptsDB.findIndex(r=>r.receiptNumber===editingReceiptId)] = data; else receiptsDB.push(data);
        saveAllData(); renderAllLogs(); $('newReceiptBtn').click();
    };
    $('newReceiptBtn').onclick = () => { editingReceiptId=null; $('receiptNumber').value=''; $('receiptDate').value=toLocalISO(new Date()); $('amountReceived').value=''; $('receiptDescription').value=''; };


    // --- Global Actions (Edit/Print) ---
    window.editInvoice = (id) => {
        const inv = invoicesDB.find(i=>i.invoiceNumber===id);
        if(!inv) return;
        editingInvoiceId = id;
        $('invoiceNumber').value=inv.invoiceNumber; $('invoiceDate').value=inv.invoiceDate; $('customerName').value=inv.customerName;
        $('itemsBody').innerHTML='';
        inv.items.forEach(i=>addItem(i.description, i.quantity, i.price));
        calcInvoice();
        $('.tab-btn[data-tab="invoiceTab"]').click(); $('.sub-tab-btn[data-tab="createInvoice"]').click();
    };
    window.editCustomer = (id) => {
        const c = customersDB.find(x=>x.id===id);
        $('custCode').value=c.id; $('custName').value=c.name; $('custTaxNumber').value=c.taxNumber; $('custPhone').value=c.phone; $('custAddress').value=c.address||'';
        $('.tab-btn[data-tab="customersTab"]').click();
    };
    window.editSupplier = (id) => {
        const s = suppliersDB.find(x=>x.id===id);
        $('supCode').value=s.id; $('supName').value=s.name; $('supTaxNumber').value=s.taxNumber; $('supPhone').value=s.phone;
        $('.tab-btn[data-tab="suppliersTab"]').click();
    };
    window.editItem = (idx) => { editingItemId=idx; $('itemName').value=itemsDB[idx].name; $('itemPrice').value=itemsDB[idx].price; $('.tab-btn[data-tab="itemsTab"]').click(); };
    window.deleteItem = (idx) => { if(confirm('حذف؟')) { itemsDB.splice(idx,1); saveAllData(); renderAllLogs(); } };

    // --- Printing ---
    function setPrintLogo(imgId) {
        const img = $(imgId);
        if(sellerInfo.logo) { img.src = sellerInfo.logo; img.style.display = 'block'; } else { img.style.display = 'none'; }
    }

    window.printInvoice = (id) => {
        const inv = invoicesDB.find(i=>i.invoiceNumber===id);
        if(!inv) return;
        setPrintLogo('printLogo');
        $('previewSellerName').innerText = sellerInfo.name;
        $('previewSellerInfo').innerText = `${sellerInfo.address} | ${sellerInfo.taxNumber}`;
        $('previewInvoiceNo').innerText = inv.invoiceNumber;
        $('previewDate').innerText = formatDate(inv.invoiceDate);
        
        let clientHtml = `<div class="detail-row"><div class="detail-label">العميل:</div><div>${inv.customerName}</div></div>`;
        const cust = customersDB.find(c=>c.id===inv.customerCode);
        if(cust) clientHtml += `<div class="detail-row"><div class="detail-label">الرقم الضريبي:</div><div>${cust.taxNumber}</div></div><div class="detail-row"><div class="detail-label">العنوان:</div><div>${cust.address||'-'}</div></div>`;
        $('previewClient').innerHTML = clientHtml;

        let rows = `<table class="items-table"><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>`;
        inv.items.forEach(i => rows += `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${formatMoney(i.price)}</td><td>${formatMoney(i.total)}</td></tr>`);
        $('previewItems').innerHTML = rows + `</tbody></table>`;
        $('previewTotals').innerHTML = `<h3>الإجمالي الكلي: ${inv.grandTotal} SAR</h3>`;
        
        // ZATCA QR (Simplified)
        const tlv = `Seller:${sellerInfo.name}|Tax:${sellerInfo.taxNumber}|Date:${inv.invoiceDate}|Total:${inv.grandTotal}|VAT:${inv.vatTotal}`;
        $('qrContainer').innerHTML=''; new QRCode($('qrContainer'), {text: tlv, width:120, height:120});

        document.body.className = 'printing-invoice';
        window.print();
    };

    window.printReceipt = (id) => {
        const r = receiptsDB.find(x=>x.receiptNumber===id);
        if(!r) return;
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
            const c = customersDB.find(x=>x.id===id); name = c.name;
            invoicesDB.filter(i=>i.customerCode===id).forEach(i => txs.push({date:i.invoiceDate, desc:`فاتورة ${i.invoiceNumber}`, deb: i.grandTotal, cred: 0}));
            receiptsDB.filter(r=>r.customerCode===id).forEach(r => txs.push({date:r.date, desc:`سند ${r.receiptNumber}`, deb: 0, cred: r.amount}));
        } else {
            const s = suppliersDB.find(x=>x.id===id); name = s.name;
            purchasesDB.filter(p=>p.supplierCode===id).forEach(p => txs.push({date:p.invoiceDate, desc:`شراء ${p.invoiceNumber}`, deb: 0, cred: p.grandTotal}));
        }
        
        txs.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        $('statementClientInfo').innerHTML = `<strong>الاسم:</strong> ${name}`;
        let bal = 0, html = '';
        txs.forEach(t => {
            bal += (parseFloat(t.deb) - parseFloat(t.cred));
            html += `<tr><td>${formatDate(t.date)}</td><td>${t.desc}</td><td>${formatMoney(t.deb)}</td><td>${formatMoney(t.cred)}</td><td>${formatMoney(bal)}</td></tr>`;
        });
        $('statementTableBody').innerHTML = html;
        $('statementSummary').innerHTML = `<h3>الرصيد الختامي: ${formatMoney(bal)}</h3>`;
        document.body.className = 'printing-statement';
        window.print();
    };

    // --- REPORTS MODULE ---
    $('generateReportBtn').onclick = () => {
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
            const total = filtered.reduce((a,b)=>a+parseFloat(b.grandTotal),0);
            summary = `<div class="report-card"><h3>إجمالي المبيعات</h3><div class="value">${formatMoney(total)}</div></div>`;
        }
        else if (type === 'purchases') {
            title = "تقرير المشتريات";
            const filtered = purchasesDB.filter(p => new Date(p.invoiceDate) >= start && new Date(p.invoiceDate) <= end);
            cols = ['رقم الفاتورة', 'التاريخ', 'المورد', 'الإجمالي'];
            data = filtered.map(p => [p.invoiceNumber, formatDate(p.invoiceDate), p.supplierName, p.grandTotal]);
            const total = filtered.reduce((a,b)=>a+parseFloat(b.grandTotal),0);
            summary = `<div class="report-card"><h3>إجمالي المشتريات</h3><div class="value">${formatMoney(total)}</div></div>`;
        }
        else if (type === 'collections') {
            title = "تقرير التحصيلات";
            const filtered = receiptsDB.filter(r => new Date(r.date) >= start && new Date(r.date) <= end);
            cols = ['رقم السند', 'التاريخ', 'العميل', 'طريقة الدفع', 'المبلغ'];
            data = filtered.map(r => [r.receiptNumber, formatDate(r.date), r.customerName, r.paymentMethod, formatMoney(r.amount)]);
            const total = filtered.reduce((a,b)=>a+parseFloat(b.amount),0);
            summary = `<div class="report-card"><h3>إجمالي المقبوضات</h3><div class="value">${formatMoney(total)}</div></div>`;
        }
        else if (type === 'inventory') {
            title = "حركة المخزون";
            cols = ['اسم الصنف', 'الكمية المشتراة', 'الكمية المباعة', 'المخزون النظري'];
            data = itemsDB.map(item => {
                const bought = getItemPurchasedQty(item.name);
                const sold = getItemSoldQty(item.name);
                return [item.name, bought, sold, (bought - sold)];
            });
        }
        else if (type === 'customerDebts') {
            title = "مديونية العملاء";
            cols = ['كود العميل', 'الاسم', 'الهاتف', 'الرصيد المستحق'];
            data = customersDB.map(c => [c.id, c.name, c.phone, getCustomerBalance(c.id)]).filter(row => parseFloat(row[3]) !== 0);
        }

        // Render Report
        $('reportTitleDisplay').innerText = title;
        $('reportDateRangeDisplay').innerText = `${formatDate(start)} - ${formatDate(end)}`;
        $('reportHeader').style.display = 'block';
        $('reportSummaryCards').innerHTML = summary;
        
        const thead = $('reportTable').querySelector('thead');
        thead.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
        
        const tbody = $('reportTable').querySelector('tbody');
        tbody.innerHTML = data.map(row => '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>').join('');
    };

    $('printReportBtn').onclick = () => { document.body.className = 'printing-report'; window.print(); };
    $('exportExcelBtn').onclick = () => {
        const wb = XLSX.utils.book_new();
        const tbl = document.getElementById('reportTable');
        const ws = XLSX.utils.table_to_sheet(tbl);
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, "Report.xlsx");
    };


    // --- Settings & Logo ---
    $('logoUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            if(evt.target.result.length > 500000) { alert('الصورة كبيرة جداً، يفضل أقل من 500kb'); }
            sellerInfo.logo = evt.target.result;
            $('logoPreview').src = sellerInfo.logo;
            $('logoPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    $('saveSettingsBtn').onclick = () => {
        sellerInfo.name = $('settingSellerName').value;
        sellerInfo.taxNumber = $('settingSellerTaxNum').value;
        sellerInfo.phone = $('settingSellerPhone').value;
        sellerInfo.address = $('settingSellerAddress').value;
        saveAllData(); alert('تم الحفظ');
    };
    
    $('exportAllBtn').onclick = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoicesDB), "Sales");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchasesDB), "Purchases");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customersDB), "Customers");
        XLSX.writeFile(wb, "Backup.xlsx");
    };
    
    $('clearAllDataBtn').onclick = () => { if(confirm('هل أنت متأكد؟')) { localStorage.removeItem(`accData_${loggedInUser}`); location.reload(); }};

    // --- Init ---
    loadAllData();
    $('settingSellerName').value = sellerInfo.name;
    $('settingSellerTaxNum').value = sellerInfo.taxNumber;
    $('settingSellerAddress').value = sellerInfo.address;
    $('settingSellerPhone').value = sellerInfo.phone;
    
    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active')); $(b.dataset.tab).classList.add('active');
    }));
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.addEventListener('click', () => {
        const p = $(b.dataset.parent);
        p.querySelectorAll('.sub-tab-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        p.querySelectorAll('.sub-tab-content').forEach(x=>x.classList.remove('active')); $(b.dataset.tab).classList.add('active');
    }));

    $('newInvoiceBtn').click();
    $('newPurchaseBtn').click();
    $('newReceiptBtn').click();
    renderAllLogs();
    
    // Reset Print Class
    window.onafterprint = () => document.body.className = '';
});
