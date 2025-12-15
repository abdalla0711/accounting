/* --- START OF FILE main.js (GLOBAL SCOPE FIXED) --- */

// 1. تعريف المتغيرات العامة
let invoicesDB = [], receiptsDB = [], itemsDB = [], customersDB = [], suppliersDB = [], purchasesDB = [], sellerInfo = {};
let editingInvoiceId = null, editingReceiptId = null, editingItemId = null;
let currentLang = 'ar';
const defaultSellerInfo = { 
    name: "اسم الشركة", taxNumber: "", phone: "", logo: "", 
    address: { city:"", district:"", street:"", build:"", zip:"", addNo:"" } 
};
const translations = {
    en: { pageTitle: "Accounting Pro", logoutBtn: "Logout", invoiceTab: "Sales", purchasesTab: "Purchases", receiptTab: "Receipts", itemsTab: "Items", customersTab: "Customers", suppliersTab: "Suppliers", reportsTab: "Reports", settingsTab: "Settings", sellerName: "Company Name", sellerTaxNumber: "Tax Number", phone: "Phone", companySection: "Company Info" },
    ar: { pageTitle: "الخبير المحاسبي", logoutBtn: "خروج", invoiceTab: "مبيعات", purchasesTab: "مشتريات", receiptTab: "سندات", itemsTab: "أصناف", customersTab: "عملاء", suppliersTab: "موردين", reportsTab: "تقارير", settingsTab: "إعدادات", sellerName: "اسم الشركة", sellerTaxNumber: "الرقم الضريبي", phone: "الهاتف", companySection: "بيانات الشركة" }
};

// 2. دوال المساعدة
const $ = (id) => document.getElementById(id);
const toLocalISO = (d) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '';
const formatMoney = (n) => parseFloat(n || 0).toFixed(2);
const getInvoice = (id) => invoicesDB.find(i => i.invoiceNumber === id);

function zatcaDataToBase64(sellerName, sellerTaxNumber, timestamp, invoiceTotal, vatTotal) {
    const toTlv = (tag, value) => {
        const valBytes = new TextEncoder().encode(String(value));
        const tlv = new Uint8Array(2 + valBytes.length);
        tlv[0] = tag; tlv[1] = valBytes.length; tlv.set(valBytes, 2);
        return tlv;
    };
    const parts = [toTlv(1, sellerName), toTlv(2, sellerTaxNumber), toTlv(3, timestamp), toTlv(4, String(invoiceTotal)), toTlv(5, String(vatTotal))];
    const combined = new Uint8Array(parts.reduce((acc, p) => acc + p.length, 0));
    let offset = 0;
    parts.forEach(p => { combined.set(p, offset); offset += p.length; });
    return btoa(String.fromCharCode.apply(null, combined));
}

// 3. تعريف دوال "Window" لتكون متاحة للـ HTML

window.logoutUser = function() {
    sessionStorage.removeItem('loggedInUser');
    window.location.href = 'index.html';
};

window.toggleLanguage = function() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    $('langToggleBtn').innerText = currentLang === 'ar' ? 'English' : 'العربية';
    document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.getAttribute('data-translate');
        if(translations[currentLang][key]) el.innerText = translations[currentLang][key];
    });
};

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active')); 
    if($(tabId)) $(tabId).classList.add('active');
};

window.switchSubTab = function(parentId, tabId) {
    const p = $(parentId); if(!p) return;
    p.querySelectorAll('.sub-tab-btn').forEach(x=>x.classList.remove('active')); 
    document.querySelector(`.sub-tab-btn[data-tab="${tabId}"]`).classList.add('active');
    p.querySelectorAll('.sub-tab-content').forEach(x=>x.classList.remove('active')); 
    if($(tabId)) $(tabId).classList.add('active');
};

// --- الفواتير والمبيعات ---
window.addItem = function(desc='', qty=1, price=0) {
    const tbody = $('itemsBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="itm-desc" value="${desc}" list="itemsDatalist" onchange="updateItemPrice(this)"></td>
                    <td><input class="itm-qty" type="number" value="${qty}" oninput="calcInvoice()"></td>
                    <td><input class="itm-price" type="number" value="${price}" oninput="calcInvoice()"></td>
                    <td class="itm-total">0.00</td>
                    <td><button class="btn danger small-action" onclick="this.closest('tr').remove();calcInvoice();" type="button">x</button></td>`;
    tbody.appendChild(tr);
    calcInvoice();
};

window.updateItemPrice = function(input) {
    const opt = Array.from($('itemsDatalist').options).find(o=>o.value===input.value);
    if(opt) {
        const row = input.closest('tr');
        row.querySelector('.itm-price').value = opt.dataset.price;
        calcInvoice();
    }
};

window.calcInvoice = function() {
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
};

window.resetInvoiceForm = function() {
    editingInvoiceId=null;
    const nextNum = getNextNumber(invoicesDB, 'INV');
    $('invoiceNumber').value = nextNum; 
    $('invoiceNumHint').innerText = `مقترح: ${nextNum}`;
    $('invoiceDate').value=toLocalISO(new Date()); 
    $('itemsBody').innerHTML=''; 
    $('customerName').value='';
    $('customerTaxNumber').value='';
    $('customerDebtDetails').style.display='none';
    window.addItem();
};

window.saveInvoice = function() {
    const custName = $('customerName').value;
    const custOpt = Array.from($('customersDatalist').options).find(o=>o.value===custName);
    if(!custOpt) return alert('اختر عميلاً صحيحاً');
    
    const data = {
        invoiceNumber: $('invoiceNumber').value,
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
    saveAllData(); renderAllLogs(); alert('تم الحفظ'); window.resetInvoiceForm();
};

window.showCustomerDebt = function(val) {
    const opt = Array.from($('customersDatalist').options).find(o => o.value === val);
    const box = $('customerDebtDetails');
    if (opt) {
        const code = opt.dataset.code;
        const cust = customersDB.find(c => c.id === code);
        $('customerTaxNumber').value = cust ? cust.taxNumber : '';
        const sales = invoicesDB.filter(i => i.customerCode == code).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
        const collected = receiptsDB.filter(r => r.customerCode == code).reduce((a, b) => a + parseFloat(b.amount || 0), 0);
        const balance = sales - collected;
        
        let invList = '<ul style="margin:5px 0; padding-right:15px; font-size:12px">';
        invoicesDB.filter(i => i.customerCode == code).slice(-5).reverse().forEach(inv => { invList += `<li>${inv.invoiceNumber} (${inv.grandTotal})</li>`; });
        invList += '</ul>';

        box.innerHTML = `<h4>رصيد العميل: ${val}</h4>
                         <div>إجمالي المبيعات: ${formatMoney(sales)}</div>
                         <div>إجمالي المسدد: ${formatMoney(collected)}</div>
                         <div style="color:red; font-weight:bold; margin-top:5px">المتبقي (المديونية): ${formatMoney(balance)}</div>
                         <div style="margin-top:5px; border-top:1px dashed #ccc">آخر فواتير:</div>${invList}`;
        box.style.display = 'block';
    } else { $('customerTaxNumber').value = ''; box.style.display = 'none'; }
};

// --- المشتريات ---
window.addPurchaseItem = function() {
    const tbody = $('purchaseItemsBody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="p-desc" list="itemsDatalist"></td><td><input class="p-qty" type="number" value="1" oninput="calcPurchase()"></td><td><input class="p-cost" type="number" value="0" oninput="calcPurchase()"></td><td class="p-total">0.00</td><td><button class="btn danger small-action" onclick="this.closest('tr').remove();calcPurchase();" type="button">x</button></td>`;
    tbody.appendChild(tr);
};
window.calcPurchase = function() {
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
};
window.resetPurchaseForm = function() {
    $('purchaseNumber').value=''; $('purchaseDate').value=toLocalISO(new Date()); 
    $('purchaseItemsBody').innerHTML=''; $('supplierName').value=''; window.addPurchaseItem();
};
window.savePurchase = function() {
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
    purchasesDB.push(data); saveAllData(); renderAllLogs(); alert("تم حفظ الشراء"); window.resetPurchaseForm();
};

// --- السندات ---
window.resetReceiptForm = function() {
    editingReceiptId=null; 
    $('receiptNumber').value = getNextNumber(receiptsDB, 'REC');
    $('receiptDate').value=toLocalISO(new Date()); 
    $('amountReceived').value=''; $('receiptDescription').value=''; 
    $('receiptCustomerName').value = ''; $('receiptCustomerBalanceDisplay').innerText = '';
};
window.saveReceipt = function() {
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
    saveAllData(); renderAllLogs(); alert("تم حفظ السند"); window.resetReceiptForm();
};
window.showReceiptBalance = function(val) {
    const opt = Array.from($('customersDatalist').options).find(o => o.value === val);
    const display = $('receiptCustomerBalanceDisplay');
    if (opt) {
        const code = opt.dataset.code;
        const totalSales = invoicesDB.filter(i => i.customerCode == code).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
        const totalCollected = receiptsDB.filter(r => r.customerCode == code).reduce((a, b) => a + parseFloat(b.amount || 0), 0);
        display.innerText = `الرصيد الحالي: ${formatMoney(totalSales - totalCollected)}`;
    } else { display.innerText = ''; }
};

// --- الأصناف والعملاء والموردين ---
window.saveItem = function() {
    const name = $('itemName').value; const price = $('itemPrice').value;
    if(!name) return;
    if(editingItemId!==null) itemsDB[editingItemId] = {name, price}; else itemsDB.push({name, price});
    saveAllData(); renderAllLogs(); window.resetItemForm();
};
window.resetItemForm = function() { editingItemId=null; $('itemName').value=''; $('itemPrice').value=''; };

window.saveCustomer = function() {
    const data = { 
        id: $('custCode').value, name: $('custName').value, taxNumber: $('custTaxNumber').value, phone: $('custPhone').value,
        address: { city: $('custCity').value, district: $('custDistrict').value, street: $('custStreet').value, build: $('custBuild').value, zip: $('custZip').value, addNo: $('custAddNo').value }
    };
    if(!data.id || !data.name) return alert('الكود والاسم مطلوبان');
    const idx = customersDB.findIndex(c=>c.id===data.id); if(idx > -1) customersDB[idx] = data; else customersDB.push(data);
    saveAllData(); renderAllLogs(); window.resetCustomerForm();
};
window.resetCustomerForm = function() { ['custCode','custName','custTaxNumber','custPhone','custCity','custDistrict','custStreet','custBuild','custZip','custAddNo'].forEach(id=>$(id).value=''); };

window.saveSupplier = function() {
    const data = { 
        id: $('supCode').value, name: $('supName').value, taxNumber: $('supTaxNumber').value, phone: $('supPhone').value,
        address: { city: $('supCity').value, district: $('supDistrict').value, street: $('supStreet').value, build: $('supBuild').value, zip: $('supZip').value, addNo: $('supAddNo').value }
    };
    if(!data.id || !data.name) return alert('الكود والاسم مطلوبان');
    const idx = suppliersDB.findIndex(s=>s.id===data.id); if(idx > -1) suppliersDB[idx] = data; else suppliersDB.push(data);
    saveAllData(); renderAllLogs(); window.resetSupplierForm();
};
window.resetSupplierForm = function() { ['supCode','supName','supTaxNumber','supPhone','supCity','supDistrict','supStreet','supBuild','supZip','supAddNo'].forEach(id=>$(id).value=''); };

// --- التقارير ---
window.generateReport = function() {
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
    else if (type === 'inventory') {
        title = "حركة المخزون";
        cols = ['اسم الصنف', 'الكمية المشتراة', 'الكمية المباعة', 'المخزون النظري'];
        data = itemsDB.map(item => {
            const bought = purchasesDB.reduce((acc, pur) => acc + (pur.items || []).filter(i => i.description === item.name).reduce((s, it) => s + parseFloat(it.quantity || 0), 0), 0);
            const sold = invoicesDB.reduce((acc, inv) => acc + (inv.items || []).filter(i => i.description === item.name).reduce((s, it) => s + parseFloat(it.quantity || 0), 0), 0);
            return [item.name, bought, sold, (bought - sold)];
        });
    }
    else if (type === 'collections') {
        title = "تقرير التحصيلات";
        const filtered = receiptsDB.filter(r => new Date(r.date) >= start && new Date(r.date) <= end);
        cols = ['رقم السند', 'التاريخ', 'العميل', 'طريقة الدفع', 'المبلغ'];
        data = filtered.map(r => [r.receiptNumber, formatDate(r.date), r.customerName, r.paymentMethod, formatMoney(r.amount)]);
        const total = filtered.reduce((a,b)=>a+parseFloat(b.amount||0),0);
        summary = `<div class="report-card"><h3>إجمالي المقبوضات</h3><div class="value">${formatMoney(total)}</div></div>`;
    }
    else if (type === 'customerDebts') {
        title = "مديونية العملاء";
        cols = ['كود العميل', 'الاسم', 'الهاتف', 'الرصيد المستحق'];
        data = customersDB.map(c => {
            const sales = invoicesDB.filter(i => i.customerCode == c.id).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
            const collected = receiptsDB.filter(r => r.customerCode == c.id).reduce((a, b) => a + parseFloat(b.amount || 0), 0);
            return [c.id, c.name, c.phone, formatMoney(sales - collected)];
        }).filter(row => parseFloat(row[3]) !== 0);
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

window.printReport = function() { document.body.className = 'printing-report'; window.print(); };

window.exportExcel = function() {
    const tbl = document.getElementById('reportTable');
    if(!tbl || tbl.rows.length === 0) return alert('لا توجد بيانات للتصدير');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(tbl);
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Report.xlsx");
};

// --- Core Data Load/Save ---
window.previewLogo = function(e) {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) { sellerInfo.logo = evt.target.result; if($('logoPreview')) $('logoPreview').src = sellerInfo.logo; };
    reader.readAsDataURL(file);
};
window.saveSettings = function() {
    sellerInfo.name = $('settingSellerName').value;
    sellerInfo.taxNumber = $('settingSellerTaxNum').value;
    sellerInfo.phone = $('settingSellerPhone').value;
    sellerInfo.address = { city: $('setCity').value, district: $('setDistrict').value, street: $('setStreet').value, build: $('setBuild').value, zip: $('setZip').value, addNo: $('setAddNo').value };
    saveAllData(); alert('تم الحفظ');
};
window.exportBackup = function() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoicesDB), "Sales");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchasesDB), "Purchases");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customersDB), "Customers");
    XLSX.writeFile(wb, "Backup.xlsx");
};
window.importBackup = function(e) {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const s2j = (n) => workbook.Sheets[n] ? XLSX.utils.sheet_to_json(workbook.Sheets[n]) : [];
            invoicesDB = s2j("Sales"); purchasesDB = s2j("Purchases"); customersDB = s2j("Customers");
            saveAllData(); alert('تم الاستعادة'); window.location.reload();
        } catch(err) { alert('خطأ في الملف'); }
    };
    reader.readAsArrayBuffer(file);
};
window.clearAllData = function() { if(confirm('حذف الكل؟')) { localStorage.removeItem(`accData_${sessionStorage.getItem('loggedInUser')}`); window.location.reload(); } };

// Internal Helpers
function saveAllData() {
    const data = { invoicesDB, receiptsDB, itemsDB, customersDB, suppliersDB, purchasesDB, sellerInfo };
    localStorage.setItem(`accData_${sessionStorage.getItem('loggedInUser')}`, JSON.stringify(data));
}
function loadAllData() {
    try {
        const raw = localStorage.getItem(`accData_${sessionStorage.getItem('loggedInUser')}`);
        if (raw) {
            const d = JSON.parse(raw);
            invoicesDB = d.invoicesDB || []; receiptsDB = d.receiptsDB || []; itemsDB = d.itemsDB || [];
            customersDB = d.customersDB || []; suppliersDB = d.suppliersDB || []; purchasesDB = d.purchasesDB || [];
            sellerInfo = { ...defaultSellerInfo, ...d.sellerInfo };
        } else { sellerInfo = defaultSellerInfo; }
        if(sellerInfo.logo && $('logoPreview')) $('logoPreview').src = sellerInfo.logo;
    } catch(e) { console.error("Load Error", e); }
}

function getNextNumber(db, prefix) {
    if (!db || db.length === 0) return `${prefix}-001`;
    const last = db[db.length-1];
    let numStr = prefix === "INV" ? last.invoiceNumber : (prefix === "REC" ? last.receiptNumber : last.invoiceNumber);
    const matches = numStr.match(/\d+$/);
    if(matches) {
        const nextVal = parseInt(matches[0]) + 1;
        return numStr.replace(/\d+$/, String(nextVal).padStart(matches[0].length, '0'));
    }
    return `${prefix}-${Date.now()}`;
}

function populateDatalists() {
    const custDL = $('customersDatalist'); custDL.innerHTML = '';
    customersDB.forEach(c => custDL.innerHTML += `<option value="${c.name}" data-code="${c.id}">`);
    const supDL = $('suppliersDatalist'); supDL.innerHTML = '';
    suppliersDB.forEach(s => supDL.innerHTML += `<option value="${s.name}" data-code="${s.id}">`);
    const itemDL = $('itemsDatalist'); itemDL.innerHTML = '';
    itemsDB.forEach(i => itemDL.innerHTML += `<option value="${i.name}" data-price="${i.price}">`);
}

function renderAllLogs() {
    // Invoice Log
    $('invoiceLogBody').innerHTML = invoicesDB.slice().reverse().map(inv => 
        `<tr><td>${inv.invoiceNumber}</td><td>${formatDate(inv.invoiceDate)}</td><td>${inv.customerName}</td><td>${inv.grandTotal}</td>
        <td class="actions"><button class="btn warning small-action" onclick="editInvoice('${inv.invoiceNumber}')">تعديل</button><button class="btn secondary small-action" onclick="printInvoice('${inv.invoiceNumber}')">طباعة</button></td></tr>`
    ).join('');
    
    // Receipt Log
    $('receiptLogBody').innerHTML = receiptsDB.slice().reverse().map(r => 
        `<tr><td>${r.receiptNumber}</td><td>${formatDate(r.date)}</td><td>${r.customerName}</td><td>${formatMoney(r.amount)}</td>
        <td class="actions"><button class="btn warning small-action" onclick="editReceipt('${r.receiptNumber}')">تعديل</button><button class="btn secondary small-action" onclick="printReceipt('${r.receiptNumber}')">طباعة</button></td></tr>`
    ).join('');
    
    // Items Log
    $('itemsLogBody').innerHTML = itemsDB.map((item, idx) => {
        const sold = invoicesDB.reduce((acc, inv) => acc + (inv.items || []).filter(i => i.description === item.name).reduce((s, it) => s + parseFloat(it.quantity || 0), 0), 0);
        return `<tr><td>${item.name}</td><td>${item.price}</td><td>${sold}</td>
        <td class="actions"><button class="btn warning small-action" onclick="editItem(${idx})">تعديل</button><button class="btn danger small-action" onclick="deleteItem(${idx})">حذف</button></td></tr>`;
    }).join('');

    // Customers Log
    $('customersLogBody').innerHTML = customersDB.map(c => {
        const sales = invoicesDB.filter(i => i.customerCode == c.id).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
        const collected = receiptsDB.filter(r => r.customerCode == c.id).reduce((a, b) => a + parseFloat(b.amount || 0), 0);
        return `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.phone}</td><td>${formatMoney(sales - collected)}</td>
        <td class="actions"><button class="btn warning small-action" onclick="editCustomer('${c.id}')">تعديل</button><button class="btn info small-action" onclick="printStatement('${c.id}', 'customer')">كشف</button></td></tr>`;
    }).join('');
    
    // Suppliers Log
    $('suppliersLogBody').innerHTML = suppliersDB.map(s => {
        const bought = purchasesDB.filter(p => p.supplierCode == s.id).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
        return `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.phone}</td><td>${formatMoney(bought)}</td>
        <td class="actions"><button class="btn warning small-action" onclick="editSupplier('${s.id}')">تعديل</button><button class="btn info small-action" onclick="printStatement('${s.id}', 'supplier')">كشف</button></td></tr>`;
    }).join('');
    
    // Purchases Log
    $('purchaseLogBody').innerHTML = purchasesDB.slice().reverse().map(p => 
        `<tr><td>${p.invoiceNumber}</td><td>${formatDate(p.invoiceDate)}</td><td>${p.supplierName}</td><td>${p.grandTotal}</td>
        <td class="actions"><button class="btn secondary small-action" onclick="printPurchase('${p.invoiceNumber}')">طباعة</button></td></tr>`
    ).join('');

    populateDatalists();
}

// --- Init Run ---
document.addEventListener('DOMContentLoaded', () => {
    // Prevent loop: checks if we are on main.html but no user
    if(!sessionStorage.getItem('loggedInUser')) { window.location.href='index.html'; return; }
    
    $('welcomeUser').innerText = `مرحباً ${sessionStorage.getItem('loggedInUser')}`;
    loadAllData();
    
    // Fill Settings Fields
    $('settingSellerName').value = sellerInfo.name || '';
    $('settingSellerTaxNum').value = sellerInfo.taxNumber || '';
    $('settingSellerPhone').value = sellerInfo.phone || '';
    const sAddr = sellerInfo.address || {};
    $('setCity').value=sAddr.city||''; $('setDistrict').value=sAddr.district||''; $('setStreet').value=sAddr.street||'';
    $('setBuild').value=sAddr.build||''; $('setZip').value=sAddr.zip||''; $('setAddNo').value=sAddr.addNo||'';

    window.resetInvoiceForm();
    window.resetPurchaseForm();
    window.resetReceiptForm();
    renderAllLogs();
    
    window.onafterprint = () => document.body.className = '';
});
