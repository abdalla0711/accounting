// --- Database & State ---
let db = { invoices:[], purchases:[], receipts:[], customers:[], suppliers:[], items:[], settings:{} };
const user = sessionStorage.getItem('loggedInUser');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (!user) { window.location.href = 'index.html'; return; }
    document.getElementById('userDisplay').innerText = user;
    
    // Load Data
    const saved = localStorage.getItem('myAppData_' + user);
    if (saved) db = JSON.parse(saved);
    
    // Set defaults if empty
    if (!db.settings) db.settings = { name:'شركتي', tax:'', phone:'' };
    
    refreshAll();
    setupDateDefaults();
});

// --- Core Functions ---
function saveData() {
    localStorage.setItem('myAppData_' + user, JSON.stringify(db));
    refreshAll();
}

function refreshAll() {
    // Fill Datalists
    fillDL('dlCustomers', db.customers, 'name');
    fillDL('dlSuppliers', db.suppliers, 'name');
    fillDL('dlItems', db.items, 'name', 'price');
    
    // Render Tables
    renderTable('tblInvoices', db.invoices, ['num','date','cust','grand'], true, 'printInvoice');
    renderTable('tblPurchases', db.purchases, ['num','date','sup','total'], true, 'printPurchase');
    renderTable('tblReceipts', db.receipts, ['num','date','cust','amount'], true, 'printReceipt');
    renderTable('tblItems', db.items, ['name','price','sold'], true); // 'sold' needs calc
    renderTable('tblCustomers', db.customers, ['name','tax','phone','balance'], true, 'printStatement');
    renderTable('tblSuppliers', db.suppliers, ['name','tax','phone'], true);
    
    // Update next number hints
    document.getElementById('nextInvHint').innerText = "التالي: " + getNextNum('INV');
}

function fillDL(id, arr, key, dataAttr=null) {
    const dl = document.getElementById(id); dl.innerHTML = '';
    arr.forEach(x => {
        const op = document.createElement('option');
        op.value = x[key];
        if(dataAttr) op.dataset.extra = x[dataAttr];
        dl.appendChild(op);
    });
}

function setupDateDefaults() {
    const now = new Date().toISOString().slice(0,16);
    ['invDate','purDate','recDate'].forEach(id => document.getElementById(id).value = now);
}

function showTab(id) {
    document.querySelectorAll('.tab-content').forEach(d => d.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).style.display = 'block';
    event.target.classList.add('active');
}

function logout() {
    sessionStorage.removeItem('loggedInUser');
    window.location.href = 'index.html';
}

// --- Sales / Invoices ---
function newInvoice() {
    document.getElementById('invNum').value = getNextNum('INV');
    document.getElementById('invCust').value = '';
    document.getElementById('invItems').innerHTML = '';
    document.getElementById('debtBox').style.display = 'none';
    calcInv();
    addInvRow();
}

function addInvRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input class="row-name" list="dlItems" onchange="setPrice(this)"></td>
        <td><input type="number" class="row-qty" value="1" oninput="calcInv()"></td>
        <td><input type="number" class="row-price" value="0" oninput="calcInv()"></td>
        <td class="row-total">0.00</td>
        <td><button class="btn danger" onclick="this.closest('tr').remove();calcInv()">x</button></td>
    `;
    document.getElementById('invItems').appendChild(tr);
}

function setPrice(inp) {
    const val = inp.value;
    const list = document.getElementById('dlItems').options;
    for(let op of list) {
        if(op.value === val) {
            inp.closest('tr').querySelector('.row-price').value = op.dataset.extra;
            calcInv(); break;
        }
    }
}

function calcInv() {
    let total = 0;
    document.querySelectorAll('#invItems tr').forEach(tr => {
        const q = parseFloat(tr.querySelector('.row-qty').value) || 0;
        const p = parseFloat(tr.querySelector('.row-price').value) || 0;
        const t = q * p;
        tr.querySelector('.row-total').innerText = t.toFixed(2);
        total += t;
    });
    const vat = total * 0.15;
    document.getElementById('invTotal').innerText = total.toFixed(2);
    document.getElementById('invVat').innerText = vat.toFixed(2);
    document.getElementById('invGrand').innerText = (total + vat).toFixed(2);
}

function saveInvoice() {
    const inv = {
        num: document.getElementById('invNum').value,
        date: document.getElementById('invDate').value,
        cust: document.getElementById('invCust').value,
        total: document.getElementById('invTotal').innerText,
        vat: document.getElementById('invVat').innerText,
        grand: document.getElementById('invGrand').innerText,
        items: []
    };
    if(!inv.cust) return alert('العميل مطلوب');
    
    document.querySelectorAll('#invItems tr').forEach(tr => {
        inv.items.push({
            name: tr.querySelector('.row-name').value,
            qty: tr.querySelector('.row-qty').value,
            price: tr.querySelector('.row-price').value,
            total: tr.querySelector('.row-total').innerText
        });
    });
    
    db.invoices.push(inv);
    saveData();
    alert('تم الحفظ');
    newInvoice();
}

function checkDebt(name) {
    const sold = db.invoices.filter(x => x.cust === name).reduce((a,b)=>a+parseFloat(b.grand),0);
    const paid = db.receipts.filter(x => x.cust === name).reduce((a,b)=>a+parseFloat(b.amount),0);
    const debt = sold - paid;
    const box = document.getElementById('debtBox');
    
    let lastInvs = db.invoices.filter(x => x.cust === name).slice(-3).map(x => `<li>${x.num}: ${x.grand}</li>`).join('');
    
    box.style.display = 'block';
    box.innerHTML = `المديونية الحالية: <b>${debt.toFixed(2)}</b> ريال<br>آخر فواتير:<ul>${lastInvs}</ul>`;
}

// --- Purchases ---
function newPurchase() {
    document.getElementById('purNum').value = '';
    document.getElementById('purSup').value = '';
    document.getElementById('purItems').innerHTML = '';
    addPurRow();
}
function addPurRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input class="p-name" list="dlItems"></td><td><input type="number" class="p-qty" value="1"></td><td><input type="number" class="p-cost" value="0" oninput="calcPur()"></td><td class="p-total">0.00</td><td><button class="btn danger" onclick="this.closest('tr').remove();calcPur()">x</button></td>`;
    document.getElementById('purItems').appendChild(tr);
}
function calcPur() {
    let t = 0;
    document.querySelectorAll('#purItems tr').forEach(tr => {
        const s = (parseFloat(tr.querySelector('.p-qty').value)||0) * (parseFloat(tr.querySelector('.p-cost').value)||0);
        tr.querySelector('.p-total').innerText = s.toFixed(2); t += s;
    });
    document.getElementById('purTotal').innerText = t.toFixed(2);
}
function savePurchase() {
    const pur = {
        num: document.getElementById('purNum').value || 'PUR-'+Date.now(),
        date: document.getElementById('purDate').value,
        sup: document.getElementById('purSup').value,
        total: document.getElementById('purTotal').innerText,
        items: []
    };
    if(!pur.sup) return alert('المورد مطلوب');
    document.querySelectorAll('#purItems tr').forEach(tr => {
        pur.items.push({ name: tr.querySelector('.p-name').value, qty: tr.querySelector('.p-qty').value });
    });
    db.purchases.push(pur);
    saveData();
    alert('تم الحفظ');
    newPurchase();
}

// --- Receipts ---
function newReceipt() {
    document.getElementById('recNum').value = getNextNum('REC');
    document.getElementById('recCust').value = '';
    document.getElementById('amountReceived').value = '';
}
function showRecBalance(name) {
    const sold = db.invoices.filter(x => x.cust === name).reduce((a,b)=>a+parseFloat(b.grand),0);
    const paid = db.receipts.filter(x => x.cust === name).reduce((a,b)=>a+parseFloat(b.amount),0);
    document.getElementById('recBalanceHint').innerText = "الرصيد: " + (sold-paid).toFixed(2);
}
function saveReceipt() {
    const rec = {
        num: document.getElementById('recNum').value,
        date: document.getElementById('recDate').value,
        cust: document.getElementById('recCust').value,
        amount: document.getElementById('recAmount').value,
        type: document.getElementById('recType').value,
        note: document.getElementById('recNote').value
    };
    if(!rec.cust) return alert('العميل مطلوب');
    db.receipts.push(rec);
    saveData();
    alert('تم الحفظ');
    newReceipt();
}

// --- Masters (Items, Cust, Sup) ---
function saveItem() {
    const item = { name: document.getElementById('itmName').value, price: document.getElementById('itmPrice').value };
    if(!item.name) return;
    // Update or Add
    const idx = db.items.findIndex(x => x.name === item.name);
    if(idx >= 0) db.items[idx] = item; else db.items.push(item);
    saveData();
    document.getElementById('itmName').value='';
}
function saveCustomer() {
    const c = { 
        name: document.getElementById('custName').value,
        tax: document.getElementById('custTax').value,
        phone: document.getElementById('custPhone').value,
        addr: {
            city: document.getElementById('custCity').value,
            dist: document.getElementById('custDist').value,
            st: document.getElementById('custSt').value,
            build: document.getElementById('custBuild').value,
            zip: document.getElementById('custZip').value,
            add: document.getElementById('custAdd').value
        }
    };
    if(!c.name) return;
    const idx = db.customers.findIndex(x => x.name === c.name);
    if(idx >= 0) db.customers[idx] = c; else db.customers.push(c);
    saveData();
    document.getElementById('custName').value='';
}
function saveSupplier() {
    const s = { 
        name: document.getElementById('supName').value,
        tax: document.getElementById('supTax').value,
        phone: document.getElementById('supPhone').value,
        addr: {
            city: document.getElementById('supCity').value,
            dist: document.getElementById('supDist').value,
            st: document.getElementById('supSt').value,
            build: document.getElementById('supBuild').value,
            zip: document.getElementById('supZip').value,
            add: document.getElementById('supAdd').value
        }
    };
    if(!s.name) return;
    const idx = db.suppliers.findIndex(x => x.name === s.name);
    if(idx >= 0) db.suppliers[idx] = s; else db.suppliers.push(s);
    saveData();
    document.getElementById('supName').value='';
}

// --- Settings ---
function saveSettings() {
    db.settings = {
        name: document.getElementById('setCoName').value,
        tax: document.getElementById('setTax').value,
        phone: document.getElementById('setPhone').value,
        logo: document.getElementById('setLogoPreview').src,
        addr: {
            city: document.getElementById('setCity').value,
            dist: document.getElementById('setDist').value,
            st: document.getElementById('setSt').value,
            build: document.getElementById('setBuild').value,
            zip: document.getElementById('setZip').value,
            add: document.getElementById('setAdd').value
        }
    };
    saveData();
}
function loadLogo(inp) {
    const f = inp.files[0];
    if(f) {
        const r = new FileReader();
        r.onload = e => document.getElementById('setLogoPreview').src = e.target.result;
        r.readAsDataURL(f);
    }
}
function wipeData() {
    if(confirm('حذف نهائي؟')) { localStorage.removeItem('myAppData_'+user); location.reload(); }
}

// --- Reports ---
function runReport() {
    const type = document.getElementById('repType').value;
    const d1 = new Date(document.getElementById('repStart').value);
    const d2 = new Date(document.getElementById('repEnd').value);
    const th = document.querySelector('#tblReport thead');
    const tb = document.querySelector('#tblReport tbody');
    tb.innerHTML = '';
    let total = 0;

    if(type === 'sales') {
        th.innerHTML = '<tr><th>التاريخ</th><th>الفاتورة</th><th>العميل</th><th>المبلغ</th></tr>';
        document.getElementById('repTitle').innerText = "تقرير المبيعات";
        db.invoices.forEach(i => {
            if(new Date(i.date) >= d1 && new Date(i.date) <= d2) {
                tb.innerHTML += `<tr><td>${i.date.slice(0,10)}</td><td>${i.num}</td><td>${i.cust}</td><td>${i.grand}</td></tr>`;
                total += parseFloat(i.grand);
            }
        });
    } else if (type === 'inventory') {
        th.innerHTML = '<tr><th>الصنف</th><th>وارد (شراء)</th><th>صادر (بيع)</th><th>رصيد</th></tr>';
        document.getElementById('repTitle').innerText = "حركة المخزون";
        db.items.forEach(it => {
            let bought = 0, sold = 0;
            db.purchases.forEach(p => p.items.forEach(pi => { if(pi.name===it.name) bought += parseFloat(pi.qty); }));
            db.invoices.forEach(i => i.items.forEach(ii => { if(ii.name===it.name) sold += parseFloat(ii.qty); }));
            tb.innerHTML += `<tr><td>${it.name}</td><td>${bought}</td><td>${sold}</td><td>${bought-sold}</td></tr>`;
        });
    } else if (type === 'debts') {
        th.innerHTML = '<tr><th>العميل</th><th>مبيعات</th><th>تحصيل</th><th>رصيد مستحق</th></tr>';
        db.customers.forEach(c => {
            const sold = db.invoices.filter(x => x.cust === c.name).reduce((a,b)=>a+parseFloat(b.grand),0);
            const paid = db.receipts.filter(x => x.cust === c.name).reduce((a,b)=>a+parseFloat(b.amount),0);
            if(sold - paid !== 0) {
                tb.innerHTML += `<tr><td>${c.name}</td><td>${sold}</td><td>${paid}</td><td>${(sold-paid).toFixed(2)}</td></tr>`;
            }
        });
    }
    // Add Summary Card
    document.getElementById('repCards').innerHTML = `<div class="r-card">الإجمالي<div class="r-val">${total.toFixed(2)}</div></div>`;
}

// --- Printing ---
function printInvoice(idx) {
    const inv = db.invoices[idx];
    prepPrintHeader('pInv');
    document.getElementById('pInvNum').innerText = inv.num;
    document.getElementById('pInvDate').innerText = inv.date;
    document.getElementById('pInvCust').innerText = "العميل: " + inv.cust;
    
    // Items
    const tb = document.querySelector('#pInvTable tbody'); tb.innerHTML='';
    inv.items.forEach(i => {
        tb.innerHTML += `<tr><td>${i.name}</td><td>${i.qty}</td><td>${i.price}</td><td>${i.total}</td></tr>`;
    });
    document.getElementById('pInvGrand').innerText = inv.grand;
    
    // QR
    const tlv = `Seller:${db.settings.name}|Tax:${db.settings.tax}|Date:${inv.date}|Total:${inv.grand}|VAT:${inv.vat}`;
    document.getElementById('pInvQR').innerHTML = '';
    new QRCode(document.getElementById('pInvQR'), { text:tlv, width:100, height:100 });

    doPrint('printInvoiceDiv');
}

function printReceipt(idx) {
    const r = db.receipts[idx];
    prepPrintHeader('pRec');
    document.getElementById('pRecNum').innerText = r.num;
    document.getElementById('pRecDate').innerText = r.date;
    document.getElementById('pRecCust').innerText = r.cust;
    document.getElementById('pRecAmount').innerText = r.amount;
    document.getElementById('pRecNote').innerText = r.note;
    document.getElementById('pRecType').innerText = r.type;
    doPrint('printReceiptDiv');
}

function printReportDiv() {
    prepPrintHeader('pRep');
    document.getElementById('pRepTitle').innerText = document.getElementById('repTitle').innerText;
    document.getElementById('pRepContent').innerHTML = document.getElementById('reportOutput').innerHTML;
    doPrint('printReportDiv');
}

// Print Helpers
function prepPrintHeader(pfx) {
    const s = db.settings;
    document.getElementById(pfx+'Co').innerText = s.name;
    document.getElementById(pfx+'CoDet').innerText = `ضريبي: ${s.tax} | هاتف: ${s.phone}`;
    if(s.logo) document.getElementById(pfx+'Logo').src = s.logo;
    if(document.getElementById(pfx+'Addr') && s.addr) {
        document.getElementById(pfx+'Addr').innerText = `${s.addr.city} - ${s.addr.dist} - ${s.addr.st}`;
    }
}

function doPrint(divId) {
    document.querySelectorAll('.print-area').forEach(d => d.classList.remove('print-area-active'));
    document.getElementById(divId).classList.add('print-area-active');
    window.print();
}

// --- Utils ---
function getNextNum(type) {
    // Simple logic: count + 1
    if(type==='INV') return 'INV-' + (db.invoices.length + 1001);
    if(type==='REC') return 'REC-' + (db.receipts.length + 1001);
}

function renderTable(id, data, cols, hasControls, printFnName) {
    const tb = document.querySelector('#'+id+' tbody');
    tb.innerHTML = '';
    data.forEach((row, i) => {
        let h = '<tr>';
        cols.forEach(k => {
            let val = row[k];
            // Calc specific columns
            if(k==='sold') {
                let sold=0; db.invoices.forEach(inv=>inv.items.forEach(x=>{if(x.name===row.name) sold+=parseFloat(x.qty)})); val=sold;
            }
            if(k==='balance') {
                const s = db.invoices.filter(x => x.cust === row.name).reduce((a,b)=>a+parseFloat(b.grand),0);
                const p = db.receipts.filter(x => x.cust === row.name).reduce((a,b)=>a+parseFloat(b.amount),0);
                val = (s-p).toFixed(2);
            }
            h += `<td>${val}</td>`;
        });
        
        if(hasControls) {
            h += `<td>`;
            if(printFnName) h += `<button class="btn secondary" onclick="${printFnName}(${i})">طباعة</button> `;
            h += `<button class="btn danger" onclick="deleteRow('${id}', ${i})">حذف</button></td>`;
        }
        h += '</tr>';
        tb.innerHTML += h;
    });
}

function deleteRow(tblId, idx) {
    if(!confirm('حذف؟')) return;
    if(tblId==='tblInvoices') db.invoices.splice(idx,1);
    if(tblId==='tblPurchases') db.purchases.splice(idx,1);
    if(tblId==='tblReceipts') db.receipts.splice(idx,1);
    if(tblId==='tblItems') db.items.splice(idx,1);
    if(tblId==='tblCustomers') db.customers.splice(idx,1);
    if(tblId==='tblSuppliers') db.suppliers.splice(idx,1);
    saveData();
}
