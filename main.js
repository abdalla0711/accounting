/* --- START OF FILE main.js (FINAL FIX) --- */

// --- GLOBAL DEFINITIONS ---
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

// --- HELPERS ---
const $ = (id) => document.getElementById(id);
const toLocalISO = (d) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '';
const formatMoney = (n) => parseFloat(n || 0).toFixed(2);
const getInvoice = (id) => invoicesDB.find(i => i.invoiceNumber === id);

// --- ZATCA TLV ENCODING (RESTORED) ---
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

// --- GLOBAL ACTIONS (Attached to Window for HTML OnClick) ---
window.printInvoice = function(id) {
    const inv = getInvoice(id); if(!inv) return;
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
        const tlvBase64 = zatcaDataToBase64(sellerInfo.name, sellerInfo.taxNumber, inv.invoiceDate, inv.grandTotal, inv.vatTotal);
        $('qrContainer').innerHTML=''; 
        new QRCode($('qrContainer'), {text: tlvBase64, width:120, height:120});
    } catch(e) { console.error("QR Error", e); }

    document.body.className = 'printing-invoice';
    window.print();
};

window.printPurchase = function(id) {
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

window.printReceipt = function(id) {
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

window.printStatement = function(id, type) {
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

window.editInvoice = function(id) {
    const inv = getInvoice(id); if(!inv) return;
    editingInvoiceId = id;
    $('invoiceNumber').value=inv.invoiceNumber; 
    $('invoiceDate').value=inv.invoiceDate; 
    $('customerName').value=inv.customerName;
    $('customerName').dispatchEvent(new Event('input')); 
    $('itemsBody').innerHTML='';
    (inv.items || []).forEach(i=>addItem(i.description, i.quantity, i.price));
    calcInvoice();
    clickTab('invoiceTab'); 
    clickSubTab('invoiceTab', 'createInvoice');
};

window.editCustomer = function(id) {
    const c = customersDB.find(x=>x.id===id); if(!c) return;
    $('custCode').value=c.id; $('custName').value=c.name; $('custTaxNumber').value=c.taxNumber; $('custPhone').value=c.phone;
    const addr = c.address || {};
    $('custCity').value=addr.city||''; $('custDistrict').value=addr.district||''; $('custStreet').value=addr.street||'';
    $('custBuild').value=addr.build||''; $('custZip').value=addr.zip||''; $('custAddNo').value=addr.addNo||'';
    clickTab('customersTab');
};

window.editSupplier = function(id) {
    const s = suppliersDB.find(x=>x.id===id); if(!s) return;
    $('supCode').value=s.id; $('supName').value=s.name; $('supTaxNumber').value=s.taxNumber; $('supPhone').value=s.phone;
    const addr = s.address || {};
    $('supCity').value=addr.city||''; $('supDistrict').value=addr.district||''; $('supStreet').value=addr.street||'';
    $('supBuild').value=addr.build||''; $('supZip').value=addr.zip||''; $('supAddNo').value=addr.addNo||'';
    clickTab('suppliersTab');
};

window.editItem = function(idx) { 
    editingItemId=idx; 
    $('itemName').value=itemsDB[idx].name; 
    $('itemPrice').value=itemsDB[idx].price; 
    clickTab('itemsTab'); 
};
    
window.deleteItem = function(idx) { 
    if(confirm('حذف؟')) { itemsDB.splice(idx,1); saveAllData(); renderAllLogs(); } 
};

window.editReceipt = function(id) {
    const r = receiptsDB.find(x=>x.receiptNumber===id); if(!r) return;
    editingReceiptId = id;
    $('receiptNumber').value=r.receiptNumber; $('receiptDate').value=r.date;
    $('receiptCustomerName').value=r.customerName; $('amountReceived').value=r.amount; 
    $('paymentMethod').value=r.paymentMethod; $('receiptDescription').value=r.description;
    clickTab('receiptTab');
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function() {

    // Auth Check
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (!loggedInUser) { window.location.href = 'index.html'; return; }
    $('welcomeUser').innerText = `مرحباً ${loggedInUser}`;

    // Load Data
    loadAllData();

    // --- Events ---
    $('logoutBtn').addEventListener('click', () => { sessionStorage.clear(); window.location.href = 'index.html'; });
    $('langToggleBtn').addEventListener('click', () => {
        currentLang = currentLang === 'ar' ? 'en' : 'ar';
        document.documentElement.lang = currentLang;
        document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
        $('langToggleBtn').innerText = currentLang === 'ar' ? 'English' : 'العربية';
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.getAttribute('data-translate');
            if(translations[currentLang][key]) el.innerText = translations[currentLang][key];
        });
    });

    // --- Helpers ---
    function setPrintLogo(imgId) {
        const img = $(imgId);
        if(sellerInfo.logo) { img.src = sellerInfo.logo; img.style.display = 'block'; } else { img.style.display = 'none'; }
    }
    function clickTab(tabId) { document.querySelector(`.tab-btn[data-tab="${tabId}"]`).click(); }
    function clickSubTab(parentId, tabId) { document.querySelector(`.sub-tab-btn[data-tab="${tabId}"][data-parent="${parentId}"]`).click(); }

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

    // --- DB Managment ---
    function saveAllData() {
        const data = { invoicesDB, receiptsDB, itemsDB, customersDB, suppliersDB, purchasesDB, sellerInfo };
        localStorage.setItem(`accData_${loggedInUser}`, JSON.stringify(data));
    }
    
    function loadAllData() {
        const raw = localStorage.getItem(`accData_${loggedInUser}`);
        if (raw) {
            const d = JSON.parse(raw);
            invoicesDB = d.invoicesDB || []; receiptsDB = d.receiptsDB || []; itemsDB = d.itemsDB || [];
            customersDB = d.customersDB || []; suppliersDB = d.suppliersDB || []; purchasesDB = d.purchasesDB || [];
            sellerInfo = { ...defaultSellerInfo, ...d.sellerInfo };
        } else { sellerInfo = defaultSellerInfo; }
        if(sellerInfo.logo && $('logoPreview')) $('logoPreview').src = sellerInfo.logo;
    }

    // --- Renderers ---
    function renderAllLogs() {
        renderInvoiceLog(); renderReceiptLog(); renderItemsLog(); renderCustomersLog(); renderSuppliersLog(); renderPurchaseLog(); populateDatalists();
    }
    
    function populateDatalists() {
        const custDL = $('customersDatalist'); custDL.innerHTML = '';
        customersDB.forEach(c => custDL.innerHTML += `<option value="${c.name}" data-code="${c.id}">`);
        const supDL = $('suppliersDatalist'); supDL.innerHTML = '';
        suppliersDB.forEach(s => supDL.innerHTML += `<option value="${s.name}" data-code="${s.id}">`);
        const itemDL = $('itemsDatalist'); itemDL.innerHTML = '';
        itemsDB.forEach(i => itemDL.innerHTML += `<option value="${i.name}" data-price="${i.price}">`);
    }

    function renderInvoiceLog() {
        const tbody = $('invoiceLogBody'); tbody.innerHTML = '';
        invoicesDB.slice().reverse().forEach(inv => {
            tbody.innerHTML += `<tr><td>${inv.invoiceNumber}</td><td>${formatDate(inv.invoiceDate)}</td><td>${inv.customerName}</td><td>${inv.grandTotal}</td>
            <td class="actions"><button class="btn warning small-action" onclick="editInvoice('${inv.invoiceNumber}')">تعديل</button><button class="btn secondary small-action" onclick="printInvoice('${inv.invoiceNumber}')">طباعة</button></td></tr>`;
        });
    }
    function renderReceiptLog() {
        const tbody = $('receiptLogBody'); tbody.innerHTML = '';
        receiptsDB.slice().reverse().forEach(r => {
            tbody.innerHTML += `<tr><td>${r.receiptNumber}</td><td>${formatDate(r.date)}</td><td>${r.customerName}</td><td>${formatMoney(r.amount)}</td>
            <td class="actions"><button class="btn warning small-action" onclick="editReceipt('${r.receiptNumber}')">تعديل</button><button class="btn secondary small-action" onclick="printReceipt('${r.receiptNumber}')">طباعة</button></td></tr>`;
        });
    }
    function renderItemsLog() {
        const tbody = $('itemsLogBody'); tbody.innerHTML = '';
        itemsDB.forEach((item, idx) => {
            const sold = invoicesDB.reduce((acc, inv) => acc + (inv.items || []).filter(i => i.description === item.name).reduce((s, it) => s + parseFloat(it.quantity || 0), 0), 0);
            tbody.innerHTML += `<tr><td>${item.name}</td><td>${item.price}</td><td>${sold}</td>
            <td class="actions"><button class="btn warning small-action" onclick="editItem(${idx})">تعديل</button><button class="btn danger small-action" onclick="deleteItem(${idx})">حذف</button></td></tr>`;
        });
    }
    function renderCustomersLog() {
        const tbody = $('customersLogBody'); tbody.innerHTML = '';
        customersDB.forEach(c => {
            const sales = invoicesDB.filter(i => i.customerCode == c.id).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
            const collected = receiptsDB.filter(r => r.customerCode == c.id).reduce((a, b) => a + parseFloat(b.amount || 0), 0);
            tbody.innerHTML += `<tr><td>${c.id}</td><td>${c.name}</td><td>${c.phone}</td><td>${formatMoney(sales - collected)}</td>
            <td class="actions"><button class="btn warning small-action" onclick="editCustomer('${c.id}')">تعديل</button><button class="btn info small-action" onclick="printStatement('${c.id}', 'customer')">كشف</button></td></tr>`;
        });
    }
    function renderSuppliersLog() {
        const tbody = $('suppliersLogBody'); tbody.innerHTML = '';
        suppliersDB.forEach(s => {
            const bought = purchasesDB.filter(p => p.supplierCode == s.id).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
            tbody.innerHTML += `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.phone}</td><td>${formatMoney(bought)}</td>
            <td class="actions"><button class="btn warning small-action" onclick="editSupplier('${s.id}')">تعديل</button><button class="btn info small-action" onclick="printStatement('${s.id}', 'supplier')">كشف</button></td></tr>`;
        });
    }
    function renderPurchaseLog() {
        const tbody = $('purchaseLogBody'); tbody.innerHTML = '';
        purchasesDB.slice().reverse().forEach(p => {
            tbody.innerHTML += `<tr><td>${p.invoiceNumber}</td><td>${formatDate(p.invoiceDate)}</td><td>${p.supplierName}</td><td>${p.grandTotal}</td>
            <td class="actions"><button class="btn secondary small-action" onclick="printPurchase('${p.invoiceNumber}')">طباعة</button></td></tr>`;
        });
    }

    // --- LOGIC: Invoice ---
    window.addItem = (desc='', qty=1, price=0) => {
        const tbody = $('itemsBody');
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input class="itm-desc" value="${desc}" list="itemsDatalist"></td><td><input class="itm-qty" type="number" value="${qty}"></td><td><input class="itm-price" type="number" value="${price}"></td><td class="itm-total">0.00</td><td><button class="btn danger small-action" onclick="this.closest('tr').remove();calcInvoice();">x</button></td>`;
        tbody.appendChild(tr);
        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', calcInvoice));
        tr.querySelector('.itm-desc').addEventListener('change', function(){
           const opt = Array.from($('itemsDatalist').options).find(o=>o.value===this.value);
           if(opt) tr.querySelector('.itm-price').value = opt.dataset.price;
           calcInvoice();
        });
        calcInvoice();
    };
    $('addItemBtn').onclick = () => addItem(); // FIXED BUTTON

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
        $('subTotal').innerText = formatMoney(sub);
        $('vatTotal').innerText = formatMoney(vat);
        $('grandTotal').innerText = formatMoney(sub + vat);
    };

    $('newInvoiceBtn').onclick = () => { 
        editingInvoiceId=null; 
        const nextNum = getNextNumber(invoicesDB, 'INV');
        $('invoiceNumber').value = nextNum; 
        $('invoiceNumHint').innerText = `مقترح: ${nextNum}`;
        $('invoiceDate').value=toLocalISO(new Date()); 
        $('itemsBody').innerHTML=''; 
        $('customerName').value='';
        $('customerTaxNumber').value='';
        $('customerDebtDetails').style.display='none';
        addItem(); 
    };

    $('generateBtn').onclick = () => {
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
        saveAllData(); renderAllLogs(); alert('تم الحفظ'); $('newInvoiceBtn').click();
    };

    // --- DEBT DISPLAY (Detailed) ---
    $('customerName').addEventListener('input', function() {
        const val = this.value;
        const opt = Array.from($('customersDatalist').options).find(o => o.value === val);
        const box = $('customerDebtDetails');
        if (opt) {
            const code = opt.dataset.code;
            const cust = customersDB.find(c => c.id === code);
            $('customerTaxNumber').value = cust ? cust.taxNumber : '';
            
            const totalSales = invoicesDB.filter(i => i.customerCode == code).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
            const totalCollected = receiptsDB.filter(r => r.customerCode == code).reduce((a, b) => a + parseFloat(b.amount || 0), 0);
            const balance = totalSales - totalCollected;

            // List last 5 invoices
            const lastInvoices = invoicesDB.filter(i => i.customerCode == code).slice(-5).reverse();
            let invList = '<ul style="margin:5px 0; padding-right:15px; font-size:12px">';
            lastInvoices.forEach(inv => { invList += `<li>${inv.invoiceNumber} (${inv.grandTotal})</li>`; });
            invList += '</ul>';

            box.innerHTML = `<h4>رصيد العميل: ${val}</h4>
                             <div>إجمالي المبيعات: ${formatMoney(totalSales)}</div>
                             <div>إجمالي المسدد: ${formatMoney(totalCollected)}</div>
                             <div style="color:red; font-weight:bold; margin-top:5px">المتبقي (المديونية): ${formatMoney(balance)}</div>
                             <div style="margin-top:5px; border-top:1px dashed #ccc">آخر فواتير:</div>
                             ${invList}`;
            box.style.display = 'block';
        } else { $('customerTaxNumber').value = ''; box.style.display = 'none'; }
    });

    // --- RECEIPT BALANCE DISPLAY ---
    $('receiptCustomerName').addEventListener('input', function() {
        const val = this.value;
        const opt = Array.from($('customersDatalist').options).find(o => o.value === val);
        const display = $('receiptCustomerBalanceDisplay');
        if (opt) {
            const code = opt.dataset.code;
            const totalSales = invoicesDB.filter(i => i.customerCode == code).reduce((a, b) => a + parseFloat(b.grandTotal || 0), 0);
            const totalCollected = receiptsDB.filter(r => r.customerCode == code).reduce((a, b) => a + parseFloat(b.amount || 0), 0);
            display.innerText = `الرصيد الحالي: ${formatMoney(totalSales - totalCollected)}`;
        } else { display.innerText = ''; }
    });

    // --- LOGIC: Purchases ---
    window.addPurchaseItem = () => {
        const tbody = $('purchaseItemsBody');
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input class="p-desc" list="itemsDatalist"></td><td><input class="p-qty" type="number" value="1"></td><td><input class="p-cost" type="number" value="0"></td><td class="p-total">0.00</td><td><button class="btn danger small-action" onclick="this.closest('tr').remove();calcPurchase();">x</button></td>`;
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
        $('purchaseSubTotal').innerText = formatMoney(sub);
        $('purchaseVatTotal').innerText = formatMoney(vat);
        $('purchaseGrandTotal').innerText = formatMoney(sub + vat);
    };
    $('addPurchaseItemBtn').onclick = addPurchaseItem;
    $('newPurchaseBtn').onclick = () => { 
        $('purchaseNumber').value=''; $('purchaseDate').value=toLocalISO(new Date()); 
        $('purchaseItemsBody').innerHTML=''; $('supplierName').value=''; addPurchaseItem(); 
    };
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
                description: r.querySelector('.p-desc').value, quantity: r.querySelector('.p-qty').value, cost: r.querySelector('.p-cost').value
            }))
        };
        purchasesDB.push(data); saveAllData(); renderAllLogs(); alert("تم حفظ الشراء"); $('newPurchaseBtn').click();
    };

    // --- LOGIC: Receipts ---
    $('saveReceiptBtn').onclick = () => {
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
    $('newReceiptBtn').onclick = () => { 
        editingReceiptId=null; 
        $('receiptNumber').value = getNextNumber(receiptsDB, 'REC');
        $('receiptDate').value=toLocalISO(new Date()); 
        $('amountReceived').value=''; $('receiptDescription').value=''; 
        $('receiptCustomerName').value = ''; $('receiptCustomerBalanceDisplay').innerText = '';
    };

    // --- Save Customers/Suppliers/Items ---
    $('saveCustomerBtn').onclick = () => {
        const data = { 
            id: $('custCode').value, name: $('custName').value, taxNumber: $('custTaxNumber').value, phone: $('custPhone').value,
            address: { city: $('custCity').value, district: $('custDistrict').value, street: $('custStreet').value, build: $('custBuild').value, zip: $('custZip').value, addNo: $('custAddNo').value }
        };
        if(!data.id || !data.name) return alert('الكود والاسم مطلوبان');
        const idx = customersDB.findIndex(c=>c.id===data.id); if(idx > -1) customersDB[idx] = data; else customersDB.push(data);
        saveAllData(); renderAllLogs(); $('clearCustomerFormBtn').click();
    };
    $('clearCustomerFormBtn').onclick = () => { ['custCode','custName','custTaxNumber','custPhone','custCity','custDistrict','custStreet','custBuild','custZip','custAddNo'].forEach(id=>$(id).value=''); };

    $('saveSupplierBtn').onclick = () => {
        const data = { 
            id: $('supCode').value, name: $('supName').value, taxNumber: $('supTaxNumber').value, phone: $('supPhone').value,
            address: { city: $('supCity').value, district: $('supDistrict').value, street: $('supStreet').value, build: $('supBuild').value, zip: $('supZip').value, addNo: $('supAddNo').value }
        };
        if(!data.id || !data.name) return alert('الكود والاسم مطلوبان');
        const idx = suppliersDB.findIndex(s=>s.id===data.id); if(idx > -1) suppliersDB[idx] = data; else suppliersDB.push(data);
        saveAllData(); renderAllLogs(); $('clearSupplierFormBtn').click();
    };
    $('clearSupplierFormBtn').onclick = () => { ['supCode','supName','supTaxNumber','supPhone','supCity','supDistrict','supStreet','supBuild','supZip','supAddNo'].forEach(id=>$(id).value=''); };

    $('saveItemBtn').onclick = () => {
        const name = $('itemName').value; const price = $('itemPrice').value;
        if(!name) return;
        if(editingItemId!==null) itemsDB[editingItemId] = {name, price}; else itemsDB.push({name, price});
        saveAllData(); renderAllLogs(); $('clearItemFormBtn').click();
    };
    $('clearItemFormBtn').onclick = () => { editingItemId=null; $('itemName').value=''; $('itemPrice').value=''; };

    // --- REPORTS FIXED ---
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
                // Ensure accessing item.quantity safely from purchases
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
    
    $('printReportBtn').onclick = () => { document.body.className = 'printing-report'; window.print(); };

    // --- Settings & Save ---
    $('logoUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) { sellerInfo.logo = evt.target.result; if($('logoPreview')) $('logoPreview').src = sellerInfo.logo; };
        reader.readAsDataURL(file);
    });
    $('saveSettingsBtn').onclick = () => {
        sellerInfo.name = $('settingSellerName').value;
        sellerInfo.taxNumber = $('settingSellerTaxNum').value;
        sellerInfo.phone = $('settingSellerPhone').value;
        sellerInfo.address = { city: $('setCity').value, district: $('setDistrict').value, street: $('setStreet').value, build: $('setBuild').value, zip: $('setZip').value, addNo: $('setAddNo').value };
        saveAllData(); alert('تم الحفظ');
    };
    $('settingSellerName').value = sellerInfo.name || '';
    $('settingSellerTaxNum').value = sellerInfo.taxNumber || '';
    $('settingSellerPhone').value = sellerInfo.phone || '';
    const sAddr = sellerInfo.address || {};
    $('setCity').value=sAddr.city||''; $('setDistrict').value=sAddr.district||''; $('setStreet').value=sAddr.street||'';
    $('setBuild').value=sAddr.build||''; $('setZip').value=sAddr.zip||''; $('setAddNo').value=sAddr.addNo||'';

    $('newInvoiceBtn').click();
    $('newPurchaseBtn').click();
    $('newReceiptBtn').click();
    renderAllLogs();
    window.onafterprint = () => document.body.className = '';
});
