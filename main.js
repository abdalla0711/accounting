document.addEventListener('DOMContentLoaded', function() {

    // --- NEW: Authentication Check ---
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (!loggedInUser) {
        // IMPORTANT: Redirect to login page if no user session is found.
        window.location.href = 'index.html';
        return; // Stop script execution
    }

    // --- DBs and State ---
    let invoicesDB, receiptsDB, itemsDB, customersDB, sellerInfo;
    let currentLang = 'ar';
    let editingInvoiceId = null, editingReceiptId = null, editingItemId = null, editingCustomerId = null;
    const defaultSellerInfo = { name: "شركتي", taxNumber: "123456789012345", address: "الرياض، السعودية", phone: "0501234567" };

    // --- Helper Functions ---
    const $ = id => document.getElementById(id);
    const toLocalDateTime = (date = new Date()) => new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
    };
    const escapeHTML = s => (s || '').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);

    // --- User-Specific Local Storage Functions ---
    function saveAllDataToLocalStorage() {
        try {
            const dataToSave = { invoicesDB, receiptsDB, itemsDB, customersDB, sellerInfo };
            localStorage.setItem(`accountingData_${loggedInUser}`, JSON.stringify(dataToSave));
        } catch (e) {
            console.error("Error saving to localStorage", e);
            alert("Could not save data automatically. Your browser might be in private mode or storage is full.");
        }
    }

    function loadAllDataFromLocalStorage() {
        const savedData = localStorage.getItem(`accountingData_${loggedInUser}`);
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                invoicesDB = data.invoicesDB || [];
                receiptsDB = data.receiptsDB || [];
                itemsDB = data.itemsDB || [];
                customersDB = data.customersDB || [];
                sellerInfo = data.sellerInfo || defaultSellerInfo;
            } catch (e) {
                console.error("Error parsing data from localStorage", e);
                initializeWithSampleData(); // Fallback to sample data on error
            }
        } else {
            // If no data exists for this user, populate with sample data
            initializeWithSampleData();
        }
    }

    // --- NEW: Sample Data for New Users ---
    function initializeWithSampleData(){
        sellerInfo = { name: "شركة الحلول المبتكرة", taxNumber: "310123456700003", address: "1234 طريق الملك فهد، حي العليا، الرياض 12211", phone: "011-465-1234" };
        
        customersDB = [
            {id: 'CUST-001', name: 'مؤسسة البناء الحديثة', taxNumber: '300123456700003', crNumber: '1010123456', nationalId: '', phone: '0501112222', address: {city: 'الرياض', district: 'الملز', street: 'شارع الستين', postalCode: '12831', buildingNumber: '4550', additionalNumber: '1234'}},
            {id: 'CUST-002', name: 'شركة التقنيات المتقدمة', taxNumber: '300765432100003', crNumber: '1010654321', nationalId: '', phone: '0533334444', address: {city: 'جدة', district: 'الشاطئ', street: 'طريق الكورنيش', postalCode: '23411', buildingNumber: '8888', additionalNumber: '5678'}},
            {id: 'CUST-003', name: 'عبدالله محمد (فردي)', taxNumber: '', crNumber: '', nationalId: '1098765432', phone: '0555556666', address: {city: 'الدمام', district: 'الروضة', street: 'شارع الأمير محمد', postalCode: '32224', buildingNumber: '1121', additionalNumber: '4321'}}
        ];

        itemsDB = [
            {name: 'استشارة فنية (ساعة)', price: 450.00}, {name: 'تطوير وحدة برمجية', price: 2500.00}, {name: 'تصميم واجهة مستخدم', price: 1800.00},
            {name: 'صيانة دورية للنظام (شهري)', price: 1500.00}, {name: 'ترخيص برنامج - مستخدم واحد', price: 950.00}, {name: 'جلسة تدريبية', price: 800.00}
        ];

        const invDate1 = new Date(); invDate1.setDate(invDate1.getDate() - 10);
        const invDate2 = new Date(); invDate2.setDate(invDate2.getDate() - 5);
        invoicesDB = [
            {invoiceNumber: 'INV-2025-001', invoiceDate: invDate1.toISOString(), customerCode: 'CUST-001', customerName: 'مؤسسة البناء الحديثة', subTotal: "4300.00", vatTotal: "645.00", grandTotal: "4945.00", items: [{description: 'تطوير وحدة برمجية', quantity: 1, price: '2500.00', total: '2500.00'},{description: 'تصميم واجهة مستخدم', quantity: 1, price: '1800.00', total: '1800.00'}]},
            {invoiceNumber: 'INV-2025-002', invoiceDate: invDate2.toISOString(), customerCode: 'CUST-002', customerName: 'شركة التقنيات المتقدمة', subTotal: "1500.00", vatTotal: "225.00", grandTotal: "1725.00", items: [{description: 'صيانة دورية للنظام (شهري)', quantity: 1, price: '1500.00', total: '1500.00'}]}
        ];
        
        const recDate1 = new Date(); recDate1.setDate(recDate1.getDate() - 2);
        receiptsDB = [
            {receiptNumber: 'REC-2025-001', date: recDate1.toISOString(), customerCode: 'CUST-001', customerName: 'مؤسسة البناء الحديثة', amount: 2000, paymentMethod: 'Bank Transfer', description: 'دفعة تحت الحساب لفاتورة INV-2025-001'}
        ];
        saveAllDataToLocalStorage(); // Save the initial sample data
    }

    // --- Translations Object ---
    const translations = {
      en: {
        pageTitle: "Invoicing & Collection System", logoutBtn: "Logout", welcome: "Welcome", invoiceTab: "Tax Invoice", receiptTab: "Receipt Voucher", itemsTab: "Items", customersTab: "Customers", settingsTab: "Data & Settings", createInvoiceSubTab: "Create Invoice", invoiceLogSubTab: "Invoice Log", createCustomerSubTab: "Create Customer", customerLogSubTab: "Customer Log", createItemSubTab: "Create Item", itemLogSubTab: "Item Log", companySection: "Company Information", sellerName: "Company Name", sellerTaxNumber: "Tax Number", sellerPhone: "Company Phone", sellerAddress: "Company Address", companySectionHint: "This information will appear on printed invoices and receipts.", invoiceAndCustomerData: "Invoice & Customer Data", invoiceNumber: "Invoice Number", invoiceDate: "Invoice Date", customerName: "Customer Name", customerNamePlaceholder: "Select or type customer name", customerTaxNumber: "Customer Tax Number", items: "Items", itemDescription: "Description", itemQty: "Qty", itemUnitPrice: "Unit Price", itemTotal: "Total", itemAction: "Action", addItemBtn: "➕ Add Item", subTotalLabel: "Subtotal:", vatTotalLabel: "VAT (15%):", grandTotalLabel: "Grand Total:", newInvoiceBtn: "➕ New", generateBtn: "💾 Save", printBtn: "🖨️ Print", invoiceLogTitle: "Invoices Log", logInvoiceNumber: "Invoice #", logDate: "Date", logCustomer: "Customer", logTotal: "Total", createReceiptSubTab: "Create Receipt", receiptLogSubTab: "Receipt Log", salesReceiptVoucher: "Sales Receipt Voucher", voucherData: "Voucher Data", receiptNumber: "Voucher No.", receiptDate: "Voucher Date", customerAndCollectionData: "Customer & Collection Data", receiptCustomerName: "Customer Name", receiptCustomerNamePlaceholder: "Select customer", amountReceived: "Amount Received", paymentMethod: "Payment Method", paymentCash: "Cash", paymentBank: "Bank Transfer", paymentCard: "Credit Card", description: "Description", receiptDescriptionLabel: "Collection Description", receiptDescriptionPlaceholder: "e.g., Payment for invoice #INV-0001", newReceiptBtn: "➕ New", saveReceiptBtn: "💾 Save Voucher", printReceiptBtn: "🖨️ Print Voucher", receiptLogTitle: "Receipts Log", logReceiptNumber: "Voucher #", logAmount: "Amount", qrScan: "Scan QR for verification", previewInvoiceNo: "Invoice No:", previewDate: "Date:", thankYou: "Thank you", receiptVoucherTitle: "Receipt Voucher", previewReceiptNumber: "Voucher No.:", previewReceivedFrom: "Received from Mr./M/s:", previewAmount: "The sum of:", previewFor: "In settlement of:", previewPaymentMethod: "Payment Method:", signatureReceiver: "Receiver: ....................", signatureStamp: "Stamp:", invoiceTo: "Bill To:",
        itemsManagement: "Items Management", addNewItem: "Add/Edit Item", itemName: "Item Name/Description", itemPrice: "Unit Price", saveItemBtn: "💾 Save Item", updateItemBtn: "💾 Update Item", savedItems: "Saved Items", qtySold: "Qty Sold", customersManagement: "Customers Management", addNewCustomer: "Add/Edit Customer", logActions: "Actions", editBtn: "Edit", deleteBtn: "Delete", confirmDelete: "Are you sure you want to delete this record? This action cannot be undone.", updateBtnText: "💾 Update Invoice", updateReceiptBtnText: "💾 Update Voucher",
        customerCode: "Customer Code", balance: "Balance", printStatement: "Statement", crNumber: "C.R. Number", nationalId: "National ID", phone: "Phone", nationalAddress: "National Address", city: "City", district: "District", street: "Street", postalCode: "Postal Code", buildingNumber: "Building No.", additionalNumber: "Additional No.", saveCustomerBtn: "💾 Save Customer", updateCustomerBtn: "💾 Update Customer", clearFormBtn: "➕ New", accountStatementTitle: "Customer Account Statement", statementTransaction: "Transaction", statementDebit: "Debit", statementCredit: "Credit", balanceDue: "Balance Due:", closingBalance: "Closing Balance", savedCustomers: "Saved Customers",
        saveSettingsBtn: "💾 Save Settings", databaseManagement: "Database Management", databaseManagementHint: "You can export a backup of your data, or restore from a file. Data is saved automatically in your browser.", exportAllBtn: "💾 Export Backup", importAllBtn: "📂 Restore from File", importSuccess: "Database restored successfully!", importError: "Failed to restore database. Please check the file format.", simplifiedTaxInvoice: "Simplified Tax Invoice",
        clearAllDataBtn: "🗑️ Clear All Data (Danger)", confirmClearAll: "ARE YOU SURE? All data for this user will be permanently deleted. This action cannot be undone."
      },
      ar: {
        pageTitle: "نظام الفواتير والسندات", logoutBtn: "تسجيل الخروج", welcome: "مرحباً", invoiceTab: "فاتورة ضريبية", receiptTab: "سند تحصيل", itemsTab: "الأصناف", customersTab: "العملاء", settingsTab: "الإعدادات والبيانات", createInvoiceSubTab: "إنشاء فاتورة", invoiceLogSubTab: "سجل الفواتير", createCustomerSubTab: "إنشاء عميل", customerLogSubTab: "سجل العملاء", createItemSubTab: "إنشاء صنف", itemLogSubTab: "سجل الأصناف", companySection: "بيانات الشركة", sellerName: "اسم الشركة", sellerTaxNumber: "الرقم الضريبي", sellerPhone: "هاتف الشركة", sellerAddress: "عنوان الشركة", companySectionHint: "هذه البيانات ستظهر في أعلى الفواتير والسندات المطبوعة.", invoiceAndCustomerData: "بيانات الفاتورة والعميل", invoiceNumber: "رقم الفاتورة", invoiceDate: "تاريخ الفاتورة", customerName: "اسم العميل", customerNamePlaceholder: "اختر أو اكتب اسم العميل", customerTaxNumber: "الرقم الضريبي للعميل", items: "الأصناف", itemDescription: "الوصف", itemQty: "الكمية", itemUnitPrice: "سعر الوحدة", itemTotal: "الإجمالي", itemAction: "إجراء", addItemBtn: "➕ إضافة صنف", subTotalLabel: "الإجمالي قبل الضريبة:", vatTotalLabel: "قيمة الضريبة (15%):", grandTotalLabel: "الإجمالي الكلي:", newInvoiceBtn: "➕ جديد", generateBtn: "💾 حفظ", printBtn: "🖨️ طباعة", invoiceLogTitle: "سجل الفواتير", logInvoiceNumber: "رقم الفاتورة", logDate: "التاريخ", logCustomer: "العميل", logTotal: "الإجمالي", createReceiptSubTab: "إنشاء سند", receiptLogSubTab: "سجل السندات", salesReceiptVoucher: "سند تحصيل مبيعات", voucherData: "بيانات السند", receiptNumber: "رقم السند", receiptDate: "تاريخ السند", customerAndCollectionData: "بيانات العميل والتحصيل", receiptCustomerName: "اسم العميل", receiptCustomerNamePlaceholder: "اختر العميل", amountReceived: "المبلغ المستلم", paymentMethod: "طريقة الدفع", paymentCash: "نقدي", paymentBank: "تحويل بنكي", paymentCard: "بطاقة ائتمان", description: "الوصف", receiptDescriptionLabel: "وصف عملية التحصيل", receiptDescriptionPlaceholder: "مثال: دفعة من فاتورة رقم INV-0001", newReceiptBtn: "➕ جديد", saveReceiptBtn: "💾 حفظ السند", printReceiptBtn: "🖨️ طباعة السند", receiptLogTitle: "سجل سندات التحصيل", logReceiptNumber: "رقم السند", logAmount: "المبلغ", qrScan: "امسح QR للتحقق", previewInvoiceNo: "فاتورة رقم:", previewDate: "التاريخ:", thankYou: "شكرا لكم", receiptVoucherTitle: "سند تحصيل", previewReceiptNumber: "رقم السند:", previewReceivedFrom: "استلمنا من السيد/السادة:", previewAmount: "مبلغ وقدره:", previewFor: "وذلك عن:", previewPaymentMethod: "طريقة الدفع:", signatureReceiver: "المستلم: ....................", signatureStamp: "الختم:", invoiceTo: "فاتورة إلى:",
        itemsManagement: "إدارة الأصناف", addNewItem: "إضافة/تعديل صنف", itemName: "اسم/وصف الصنف", itemPrice: "سعر الوحدة", saveItemBtn: "💾 حفظ الصنف", updateItemBtn: "💾 تحديث الصنف", savedItems: "الأصناف المحفوظة", qtySold: "الكمية المباعة", customersManagement: "إدارة العملاء", addNewCustomer: "إضافة/تعديل عميل", logActions: "إجراءات", editBtn: "تعديل", deleteBtn: "حذف", confirmDelete: "هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.", updateBtnText: "💾 تحديث الفاتورة", updateReceiptBtnText: "💾 تحديث السند",
        customerCode: "كود العميل", balance: "الرصيد", printStatement: "كشف حساب", crNumber: "رقم السجل التجاري", nationalId: "رقم الهوية", phone: "رقم الهاتف", nationalAddress: "العنوان الوطني", city: "المدينة", district: "الحي", street: "الشارع", postalCode: "الرمز البريدي", buildingNumber: "رقم المبنى", additionalNumber: "الرقم الإضافي", saveCustomerBtn: "💾 حفظ العميل", updateCustomerBtn: "💾 تحديث العميل", clearFormBtn: "➕ جديد", accountStatementTitle: "كشف حساب عميل", statementTransaction: "الحركة", statementDebit: "مدين", statementCredit: "دائن", balanceDue: "الرصيد المستحق:", closingBalance: "الرصيد الختامي", savedCustomers: "العملاء المحفوظون",
        saveSettingsBtn: "💾 حفظ الإعدادات", databaseManagement: "إدارة قاعدة البيانات", databaseManagementHint: "يمكنك أخذ نسخة احتياطية من كل بياناتك في ملف، أو استعادة البيانات من نسخة سابقة. البيانات تحفظ تلقائياً في المتصفح.", exportAllBtn: "💾 تصدير نسخة احتياطية", importAllBtn: "📂 استعادة من ملف", importSuccess: "تم استعادة قاعدة البيانات بنجاح!", importError: "فشل استعادة قاعدة البيانات. الرجاء التأكد من صيغة الملف.", simplifiedTaxInvoice: "فاتورة ضريبية مبسطة",
        clearAllDataBtn: "🗑️ مسح كل البيانات (خطر)", confirmClearAll: "هل أنت متأكد تماماً؟ سيتم حذف كل بيانات هذا المستخدم بشكل نهائي. لا يمكن التراجع عن هذا الإجراء."
      }
    };

    // --- Language Switcher ---
    function setLanguage(lang) {
        currentLang = lang;
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        $('langToggleBtn').innerText = lang === 'ar' ? 'English' : 'العربية';
        document.querySelectorAll('[data-translate]').forEach(el => {
            const key = el.getAttribute('data-translate');
            if (translations[lang][key]) {
                el.innerText = translations[lang][key];
            }
        });
        document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
            const key = el.getAttribute('data-translate-placeholder');
            if (translations[lang][key]) el.placeholder = translations[lang][key];
        });
        // Update welcome message dynamically
        $('welcomeUser').innerText = `${translations[lang].welcome}, ${loggedInUser}`;
        updateMainActionButtonsText();
    }

    function updateMainActionButtonsText() {
        const t = translations[currentLang];
        $('generateBtn').innerText = editingInvoiceId ? t.updateBtnText : t.generateBtn;
        $('saveReceiptBtn').innerText = editingReceiptId ? t.updateReceiptBtnText : t.saveReceiptBtn;
        $('saveItemBtn').innerText = editingItemId ? t.updateItemBtn : t.saveItemBtn;
        $('saveCustomerBtn').innerText = editingCustomerId ? t.updateCustomerBtn : t.saveCustomerBtn;
    }

    // --- Tab Switching ---
    function setupTabSwitching() {
        document.querySelectorAll('.tab-btn, .sub-tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                const isMainTab = button.classList.contains('tab-btn');
                if(isMainTab){
                    document.querySelectorAll('.preview, .statement-preview').forEach(p => p.style.display = 'none');
                }
                const parentId = button.dataset.parent;
                const navSelector = isMainTab ? '.tabs-nav' : `div[id="${parentId}"] .sub-tabs-nav`;
                const contentSelector = isMainTab ? '.tab-content' : `div[id="${parentId}"] .sub-tab-content`;

                document.querySelectorAll(`${navSelector} > button`).forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                document.querySelectorAll(contentSelector).forEach(content => content.classList.remove('active'));
                $(button.dataset.tab).classList.add('active');
            });
        });
    }

    // --- Calculation and Rendering ---
    function calculateCustomerBalance(customerCode) {
        const totalInvoices = invoicesDB.filter(inv => inv.customerCode === customerCode).reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
        const totalReceipts = receiptsDB.filter(rec => rec.customerCode === customerCode).reduce((sum, rec) => sum + parseFloat(rec.amount), 0);
        return (totalInvoices - totalReceipts).toFixed(2);
    }
    function calculateItemSales(itemName) {
        return invoicesDB.reduce((totalQty, inv) => {
            const itemInInvoice = inv.items.find(item => item.description === itemName);
            return totalQty + (itemInInvoice ? parseFloat(itemInInvoice.quantity || 0) : 0);
        }, 0);
    }

    function renderAllLogs() {
        renderCustomersLog();
        renderInvoiceLog();
        renderReceiptLog();
        renderItemsLog();
    }

    // --- Data Management (Customers, Items, Invoices, Receipts) ---
    function renderCustomersLog() {
        const logBody = $('customersLogBody');
        logBody.innerHTML = '';
        const t = translations[currentLang];
        customersDB.forEach((cust) => {
            const balance = calculateCustomerBalance(cust.id);
            const balanceColor = parseFloat(balance) >= 0 ? 'blue' : 'red';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHTML(cust.id)}</td>
                <td>${escapeHTML(cust.name)}</td>
                <td>${escapeHTML(cust.phone)}</td>
                <td style="color:${balanceColor}; font-weight:bold;">${balance}</td>
                <td class="actions">
                    <button class="btn warning small-action edit-btn" data-type="customer" data-id="${cust.id}">${t.editBtn}</button>
                    <button class="btn danger small-action delete-btn" data-type="customer" data-id="${cust.id}">${t.deleteBtn}</button>
                    <button class="btn info small-action statement-btn" data-type="customer" data-id="${cust.id}">${t.printStatement}</button>
                </td>`;
            logBody.appendChild(tr);
        });
        populateCustomersDatalist();
    }

    function populateCustomersDatalist() {
        const datalist = $('customersDatalist');
        if(!datalist) return;
        datalist.innerHTML = '';
        customersDB.forEach(cust => {
            datalist.innerHTML += `<option value="${escapeHTML(cust.name)}" data-code="${escapeHTML(cust.id)}"></option>`;
        });
    }

    function clearCustomerForm() {
        editingCustomerId = null;
        const fields = ['custCode', 'custName', 'custTaxNumber', 'custCrNumber', 'custNationalId', 'custPhone', 'custCity', 'custDistrict', 'custStreet', 'custPostalCode', 'custBuildingNumber', 'custAdditionalNumber'];
        fields.forEach(f => $(f).value = '');
        $('custCode').disabled = false;
        updateMainActionButtonsText();
    }

    function saveCustomer() {
        const id = $('custCode').value.trim();
        if (!id) { alert(translations[currentLang].customerCode + " is required."); return; }
        if (editingCustomerId === null && customersDB.some(c => c.id === id)) {
            alert("Customer code already exists.");
            return;
        }
        const customerData = {
            id, name: $('custName').value.trim(), taxNumber: $('custTaxNumber').value.trim(), crNumber: $('custCrNumber').value.trim(), nationalId: $('custNationalId').value.trim(), phone: $('custPhone').value.trim(),
            address: { city: $('custCity').value.trim(), district: $('custDistrict').value.trim(), street: $('custStreet').value.trim(), postalCode: $('custPostalCode').value.trim(), buildingNumber: $('custBuildingNumber').value.trim(), additionalNumber: $('custAdditionalNumber').value.trim() }
        };
        if (editingCustomerId !== null) {
            const index = customersDB.findIndex(c => c.id === editingCustomerId);
            if(index > -1) customersDB[index] = customerData;
        } else {
            customersDB.push(customerData);
        }
        clearCustomerForm();
        renderCustomersLog();
        saveAllDataToLocalStorage();
    }

    function renderItemsLog() {
        const logBody = $('itemsLogBody');
        logBody.innerHTML = '';
        const t = translations[currentLang];
        itemsDB.forEach((item, index) => {
            const qtySold = calculateItemSales(item.name);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHTML(item.name)}</td>
                <td>${item.price}</td>
                <td>${qtySold}</td>
                <td class="actions">
                    <button class="btn warning small-action edit-btn" data-type="item" data-id="${index}">${t.editBtn}</button>
                    <button class="btn danger small-action delete-btn" data-type="item" data-id="${index}">${t.deleteBtn}</button>
                </td>`;
            logBody.appendChild(tr);
        });
        populateItemsDatalist();
    }

    function populateItemsDatalist() {
        const datalist = $('itemsDatalist');
        if(!datalist) return;
        datalist.innerHTML = '';
        itemsDB.forEach(item => {
            datalist.innerHTML += `<option value="${escapeHTML(item.name)}"></option>`;
        });
    }

    function clearItemForm() {
        editingItemId = null;
        $('itemName').value = '';
        $('itemPrice').value = '';
        updateMainActionButtonsText();
    }

    function saveItem() {
        const name = $('itemName').value.trim();
        const price = parseFloat($('itemPrice').value) || 0;
        if (!name) return;
        if (editingItemId !== null) {
            itemsDB[editingItemId] = { name, price };
        } else {
            itemsDB.push({ name, price });
        }
        clearItemForm();
        renderItemsLog();
        saveAllDataToLocalStorage();
    }

    function renderInvoiceLog() {
        const logBody = $('invoiceLogBody');
        logBody.innerHTML = '';
        const t = translations[currentLang];
        invoicesDB.forEach((inv) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHTML(inv.invoiceNumber)}</td><td>${formatDate(inv.invoiceDate)}</td>
                <td>${escapeHTML(inv.customerName)}</td><td>${inv.grandTotal}</td>
                <td class="actions">
                    <button class="btn warning small-action edit-btn" data-type="invoice" data-id="${inv.invoiceNumber}">${t.editBtn}</button>
                    <button class="btn danger small-action delete-btn" data-type="invoice" data-id="${inv.invoiceNumber}">${t.deleteBtn}</button>
                    <button class="btn secondary small-action print-btn" data-type="invoice" data-id="${inv.invoiceNumber}">${t.printBtn}</button>
                </td>`;
            logBody.appendChild(tr);
        });
    }

    function clearInvoiceForm() {
        editingInvoiceId = null;
        $('invoiceNumber').value = '';
        $('invoiceDate').value = toLocalDateTime();
        $('customerName').value = '';
        $('customerTaxNumber').value = '';
        $('customerBalanceDisplay').textContent = '';
        $('itemsBody').innerHTML = '';
        addItem('', 1, 0);
        updateMainActionButtonsText();
    }

    function saveInvoice() {
        const customerName = $("customerName").value;
        const selectedOption = Array.from($('customersDatalist').options).find(opt => opt.value === customerName);
        const customerCode = selectedOption ? selectedOption.dataset.code : null;
        if (!customerCode) { alert("Please select a valid customer."); return null; }
        const invoiceNumber = $("invoiceNumber").value.trim() || `INV-${Date.now()}`;
        if (editingInvoiceId === null && invoicesDB.some(inv => inv.invoiceNumber === invoiceNumber)) {
            alert(`Invoice number ${invoiceNumber} already exists.`); return null;
        }
        const invoiceData = {
            invoiceNumber, invoiceDate: new Date($('invoiceDate').value).toISOString(), customerCode, customerName,
            subTotal: parseFloat($("subTotal").innerText).toFixed(2), vatTotal: parseFloat($("vatTotal").innerText).toFixed(2), grandTotal: parseFloat($("grandTotal").innerText).toFixed(2),
            items: Array.from($('itemsBody').querySelectorAll('tr')).map(r => ({ description: r.querySelector('.txt-desc').value, quantity: r.querySelector('.txt-qty').value, price: r.querySelector('.txt-price').value, total: r.querySelector('.cell-line-total').innerText }))
        };
        if (editingInvoiceId) {
            const index = invoicesDB.findIndex(inv => inv.invoiceNumber === editingInvoiceId);
            if (index > -1) invoicesDB[index] = invoiceData;
        } else {
            invoicesDB.push(invoiceData);
        }
        renderAllLogs();
        clearInvoiceForm();
        saveAllDataToLocalStorage();
        return invoiceData;
    }

    function renderReceiptLog() {
        const logBody = $('receiptLogBody');
        logBody.innerHTML = '';
        const t = translations[currentLang];
        receiptsDB.forEach((rec) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHTML(rec.receiptNumber)}</td><td>${formatDate(rec.date)}</td>
                <td>${escapeHTML(rec.customerName)}</td><td>${rec.amount}</td>
                <td class="actions">
                    <button class="btn warning small-action edit-btn" data-type="receipt" data-id="${rec.receiptNumber}">${t.editBtn}</button>
                    <button class="btn danger small-action delete-btn" data-type="receipt" data-id="${rec.receiptNumber}">${t.deleteBtn}</button>
                    <button class="btn secondary small-action print-btn" data-type="receipt" data-id="${rec.receiptNumber}">${t.printBtn}</button>
                </td>`;
            logBody.appendChild(tr);
        });
    }

    function clearReceiptForm() {
        editingReceiptId = null;
        $('receiptNumber').value = '';
        $('receiptDate').value = toLocalDateTime();
        $('receiptCustomerName').value = '';
        $('amountReceived').value = '';
        $('receiptDescription').value = '';
        $('receiptCustomerBalanceDisplay').textContent = '';
        updateMainActionButtonsText();
    }

    function saveReceipt() {
        const customerName = $("receiptCustomerName").value;
        const selectedOption = Array.from($('customersDatalist').options).find(opt => opt.value === customerName);
        const customerCode = selectedOption ? selectedOption.dataset.code : null;
        if (!customerCode) { alert("Please select a valid customer."); return null; }
        const receiptNumber = $('receiptNumber').value.trim() || `REC-${Date.now()}`;
        if (editingReceiptId === null && receiptsDB.some(rec => rec.receiptNumber === receiptNumber)) {
            alert(`Receipt number ${receiptNumber} already exists.`); return null;
        }
        const receiptData = {
            receiptNumber, date: new Date($('receiptDate').value).toISOString(), customerCode, customerName,
            amount: parseFloat($('amountReceived').value) || 0, paymentMethod: $('paymentMethod').value, description: $('receiptDescription').value,
        };
        if (editingReceiptId) {
            const index = receiptsDB.findIndex(rec => rec.receiptNumber === editingReceiptId);
            if (index > -1) receiptsDB[index] = receiptData;
        } else {
            receiptsDB.push(receiptData);
        }
        renderAllLogs();
        clearReceiptForm();
        saveAllDataToLocalStorage();
        return receiptData;
    }

    // --- Invoice Item Management ---
    function recalcAll() {
        let subtotal = 0;
        $('itemsBody').querySelectorAll('tr').forEach(r => {
            const qty = parseFloat(r.querySelector('.txt-qty').value) || 0;
            const price = parseFloat(r.querySelector('.txt-price').value) || 0;
            const lineTotal = qty * price;
            r.querySelector('.cell-line-total').innerText = lineTotal.toFixed(2);
            subtotal += lineTotal;
        });
        const vat = subtotal * 0.15;
        const total = subtotal + vat;
        $("subTotal").innerText = subtotal.toFixed(2);
        $("vatTotal").innerText = vat.toFixed(2);
        $("grandTotal").innerText = total.toFixed(2);
    }

    function addItem(desc = '', qty = 1, price = 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input class="txt-desc" type="text" value="${escapeHTML(desc)}" list="itemsDatalist"></td>
            <td><input class="txt-qty" type="number" min="0" step="any" value="${qty}"></td>
            <td><input class="txt-price" type="number" min="0" step="any" value="${price}"></td>
            <td class="cell-line-total">0.00</td>
            <td><button class="btn danger btn-del no-print">${translations[currentLang].deleteBtn}</button></td>`;
        $('itemsBody').appendChild(tr);
        const descInput = tr.querySelector('.txt-desc');
        descInput.addEventListener('input', () => {
            const selectedItem = itemsDB.find(i => i.name === descInput.value);
            if (selectedItem) { tr.querySelector('.txt-price').value = selectedItem.price; recalcAll(); }
        });
        tr.querySelectorAll('input').forEach(inp => inp.addEventListener('input', recalcAll));
        tr.querySelector('.btn-del').addEventListener('click', () => { tr.remove(); recalcAll(); });
        recalcAll();
    }

    // --- Previews and Printing ---
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

    function generateInvoicePreview(invoiceData) {
        if (!invoiceData) return;
        const t = translations[currentLang];
        const customer = customersDB.find(c => c.id === invoiceData.customerCode);
        $('previewSellerName').innerText = sellerInfo.name;
        $('previewSellerInfo').innerHTML = `${sellerInfo.address}<br>${t.phone}: ${sellerInfo.phone}<br>${t.sellerTaxNumber}: ${sellerInfo.taxNumber}`;
        $('invoiceTitle').innerText = t.simplifiedTaxInvoice;
        let clientHtml = '';
        if (customer) {
            const addr = customer.address || {};
            const fullAddress = `${addr.buildingNumber} ${addr.street}, ${addr.district}, ${addr.city} ${addr.postalCode}`;
            clientHtml = `<div class="detail-row"><div class="detail-label">${t.customerName}:</div><div>${escapeHTML(customer.name)}</div></div>` +
                         `<div class="detail-row"><div class="detail-label">${t.customerTaxNumber}:</div><div>${escapeHTML(customer.taxNumber)}</div></div>` +
                         `<div class="detail-row"><div class="detail-label">${t.crNumber}:</div><div>${escapeHTML(customer.crNumber)}</div></div>` +
                         `<div class="detail-row"><div class="detail-label">${t.phone}:</div><div>${escapeHTML(customer.phone)}</div></div>` +
                         `<div class="detail-row"><div class="detail-label">${t.nationalAddress}:</div><div>${escapeHTML(fullAddress)}</div></div>`;
        }
        $('previewClient').innerHTML = clientHtml;
        $('previewInvoiceNo').innerText = invoiceData.invoiceNumber;
        $('previewDate').innerText = formatDate(invoiceData.invoiceDate);
        let itemsHtml = `<table class="items-table" style="font-size:14px; text-align:center;"><thead><tr><th>${t.itemDescription}</th><th>${t.itemQty}</th><th>${t.itemUnitPrice}</th><th>${t.itemTotal}</th></tr></thead><tbody>`;
        invoiceData.items.forEach(item => { itemsHtml += `<tr><td>${escapeHTML(item.description)}</td><td>${escapeHTML(item.quantity)}</td><td>${parseFloat(item.price||0).toFixed(2)}</td><td>${parseFloat(item.total||0).toFixed(2)}</td></tr>`; });
        $('previewItems').innerHTML = itemsHtml + '</tbody></table>';
        $('previewTotals').innerHTML = `<table style="width:50%;margin-${currentLang==='ar'?'right':'left'}:auto;margin-${currentLang==='ar'?'left':'right'}:0;"><tr><td>${t.subTotalLabel}</td><td>${invoiceData.subTotal} SAR</td></tr><tr><td>${t.vatTotalLabel}</td><td>${invoiceData.vatTotal} SAR</td></tr><tr><td><b>${t.grandTotalLabel}</b></td><td><b>${invoiceData.grandTotal} SAR</b></td></tr></table>`;
        const tlvBase64 = zatcaDataToBase64(sellerInfo.name, sellerInfo.taxNumber, invoiceData.invoiceDate, invoiceData.grandTotal, invoiceData.vatTotal);
        $('qrContainer').innerHTML = '';
        new QRCode($("qrContainer"), { text: tlvBase64, width: 140, height: 140 });
        document.querySelectorAll('.preview, .statement-preview').forEach(p => p.style.display = 'none');
        $('invoicePreview').style.display = 'block';
    }

    function generateReceiptPreview(receiptData) {
        if (!receiptData) return;
        const t = translations[currentLang];
        $('receiptPreviewSellerName').innerText = sellerInfo.name;
        $('receiptPreviewSellerInfo').innerText = `${sellerInfo.address} | ${sellerInfo.phone}`;
        $('receiptPreviewNumber').innerText = receiptData.receiptNumber;
        $('receiptPreviewDate').innerText = formatDate(receiptData.date);
        $('receiptPreviewCustomer').innerText = receiptData.customerName;
        $('receiptPreviewAmount').innerText = `${parseFloat(receiptData.amount).toFixed(2)} SAR`;
        $('receiptPreviewDesc').innerText = receiptData.description;
        $('receiptPreviewPayment').innerText = t[Object.keys(t).find(k => t[k] === receiptData.paymentMethod)] || receiptData.paymentMethod;
        document.querySelectorAll('.preview, .statement-preview').forEach(p => p.style.display = 'none');
        $('receiptPreview').style.display = 'block';
    }

    function generateStatementPreview(customerCode) {
        const customer = customersDB.find(c => c.id === customerCode);
        if (!customer) return;
        const t = translations[currentLang];
        $('statementSellerName').innerText = sellerInfo.name;
        $('statementSellerInfo').innerText = `${sellerInfo.address} | ${sellerInfo.phone}`;
        $('statementClientInfo').innerHTML = `<strong>${t.customerName}:</strong> ${customer.name} | <strong>${t.customerCode}:</strong> ${customer.id}`;
        const customerInvoices = invoicesDB.filter(inv => inv.customerCode === customerCode).map(inv => ({ date: new Date(inv.invoiceDate), desc: `${t.logInvoiceNumber} ${inv.invoiceNumber}`, debit: parseFloat(inv.grandTotal), credit: 0 }));
        const customerReceipts = receiptsDB.filter(rec => rec.customerCode === customerCode).map(rec => ({ date: new Date(rec.date), desc: `${t.logReceiptNumber} ${rec.receiptNumber}`, debit: 0, credit: parseFloat(rec.amount) }));
        const transactions = [...customerInvoices, ...customerReceipts].sort((a,b) => a.date - b.date);
        const tableBody = $('statementTableBody');
        tableBody.innerHTML = '';
        let runningBalance = 0;
        transactions.forEach(tx => {
            runningBalance += tx.debit - tx.credit;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${formatDate(tx.date)}</td><td>${escapeHTML(tx.desc)}</td><td>${tx.debit.toFixed(2)}</td><td>${tx.credit.toFixed(2)}</td><td>${runningBalance.toFixed(2)}</td>`;
            tableBody.appendChild(tr);
        });
        $('statementSummary').innerHTML = `<strong>${t.closingBalance}: ${runningBalance.toFixed(2)} SAR</strong>`;
        document.querySelectorAll('.preview, .statement-preview').forEach(p => p.style.display = 'none');
        $('statementPreview').style.display = 'block';
    }

    function handleCustomerSelection(e, balanceDisplayId) {
        const input = e.target;
        const balanceDisplay = $(balanceDisplayId);
        balanceDisplay.textContent = '';
        const selectedOption = Array.from(document.getElementById('customersDatalist').options).find(opt => opt.value === input.value);
        if (selectedOption) {
            const customerCode = selectedOption.dataset.code;
            const customer = customersDB.find(c => c.id === customerCode);
            if (customer) {
                if (input.id === 'customerName') { $('customerTaxNumber').value = customer.taxNumber; }
                const balance = calculateCustomerBalance(customer.id);
                balanceDisplay.textContent = `${translations[currentLang].balance}: ${balance}`;
            }
        }
    }

    // --- Settings and Data Backup/Restore ---
    function loadSettingsForm() {
        $('settingSellerName').value = sellerInfo.name;
        $('settingSellerTaxNum').value = sellerInfo.taxNumber;
        $('settingSellerAddress').value = sellerInfo.address;
        $('settingSellerPhone').value = sellerInfo.phone;
    }

    function saveSettings() {
        sellerInfo.name = $('settingSellerName').value;
        sellerInfo.taxNumber = $('settingSellerTaxNum').value;
        sellerInfo.address = $('settingSellerAddress').value;
        sellerInfo.phone = $('settingSellerPhone').value;
        saveAllDataToLocalStorage();
        alert("تم حفظ إعدادات الشركة.");
    }

    function exportAllData() {
        const workbook = XLSX.utils.book_new();
        const flattenedCustomers = customersDB.map(c => ({ ...(c.address || {}), ...c, address: undefined }));
        const invoicesForExport = invoicesDB.map(invoice => ({ ...invoice, items: JSON.stringify(invoice.items || []) }));
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(flattenedCustomers), "Customers");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(itemsDB), "Items");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(invoicesForExport), "Invoices");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(receiptsDB), "Receipts");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([sellerInfo]), "Settings");
        XLSX.writeFile(workbook, `backup-${loggedInUser}-${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    function importAllData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const safeSheetToJSON = (sheetName) => workbook.Sheets[sheetName] ? XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) : [];

                const importedCustomers = safeSheetToJSON("Customers").map(c => ({ id: c.id, name: c.name, taxNumber: c.taxNumber, crNumber: c.crNumber, nationalId: c.nationalId, phone: c.phone, address: { city: c.city, district: c.district, street: c.street, postalCode: c.postalCode, buildingNumber: c.buildingNumber, additionalNumber: c.additionalNumber }}));
                const importedItems = safeSheetToJSON("Items");
                const importedReceipts = safeSheetToJSON("Receipts");
                const importedSettings = safeSheetToJSON("Settings");
                const importedInvoices = safeSheetToJSON("Invoices").map(inv => ({ ...inv, items: typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []) }));

                customersDB = importedCustomers;
                itemsDB = importedItems;
                invoicesDB = importedInvoices;
                receiptsDB = importedReceipts;
                if (importedSettings.length > 0) sellerInfo = importedSettings[0];

                saveAllDataToLocalStorage();
                alert(translations[currentLang].importSuccess);
                location.reload();
            } catch (err) {
                console.error(err);
                alert(translations[currentLang].importError);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    }

    function clearCurrentUserData() {
        if (confirm(translations[currentLang].confirmClearAll)) {
            localStorage.removeItem(`accountingData_${loggedInUser}`);
            location.reload();
        }
    }

    // --- UNIVERSAL EVENT HANDLERS ---
    function handleEdit(type, id) {
        if (type === 'customer') {
            const cust = customersDB.find(c => c.id === id);
            if (!cust) return;
            editingCustomerId = id;
            $('custCode').value = cust.id; $('custCode').disabled = true;
            $('custName').value = cust.name; $('custTaxNumber').value = cust.taxNumber;
            $('custCrNumber').value = cust.crNumber; $('custNationalId').value = cust.nationalId; $('custPhone').value = cust.phone;
            const addr = cust.address || {};
            $('custCity').value = addr.city; $('custDistrict').value = addr.district; $('custStreet').value = addr.street;
            $('custPostalCode').value = addr.postalCode; $('custBuildingNumber').value = addr.buildingNumber; $('custAdditionalNumber').value = addr.additionalNumber;
            updateMainActionButtonsText();
            document.querySelector('.tab-btn[data-tab="customersTab"]').click();
            document.querySelector('.sub-tab-btn[data-tab="createCustomer"]').click();
        } else if (type === 'item') {
            const item = itemsDB[id];
            if (!item) return;
            editingItemId = id;
            $('itemName').value = item.name; $('itemPrice').value = item.price;
            updateMainActionButtonsText();
            document.querySelector('.tab-btn[data-tab="itemsTab"]').click();
            document.querySelector('.sub-tab-btn[data-tab="createItem"]').click();
        } else if (type === 'invoice') {
            const inv = invoicesDB.find(i => i.invoiceNumber === id);
            if (!inv) return;
            editingInvoiceId = id;
            $('invoiceNumber').value = inv.invoiceNumber; $('invoiceDate').value = toLocalDateTime(new Date(inv.invoiceDate));
            $('customerName').value = inv.customerName;
            handleCustomerSelection({target: $('customerName')}, 'customerBalanceDisplay');
            $('itemsBody').innerHTML = '';
            inv.items.forEach(item => addItem(item.description, item.quantity, item.price));
            updateMainActionButtonsText();
            document.querySelector('.tab-btn[data-tab="invoiceTab"]').click();
            document.querySelector('.sub-tab-btn[data-tab="createInvoice"]').click();
        } else if (type === 'receipt') {
            const rec = receiptsDB.find(r => r.receiptNumber === id);
            if (!rec) return;
            editingReceiptId = id;
            $('receiptNumber').value = rec.receiptNumber; $('receiptDate').value = toLocalDateTime(new Date(rec.date));
            $('receiptCustomerName').value = rec.customerName;
            $('amountReceived').value = rec.amount; $('paymentMethod').value = rec.paymentMethod; $('receiptDescription').value = rec.description;
            handleCustomerSelection({target: $('receiptCustomerName')}, 'receiptCustomerBalanceDisplay');
            updateMainActionButtonsText();
            document.querySelector('.tab-btn[data-tab="receiptTab"]').click();
            document.querySelector('.sub-tab-btn[data-tab="createReceipt"]').click();
        }
    }

    function handleDelete(type, id) {
        if (!confirm(translations[currentLang].confirmDelete)) return;
        if (type === 'customer') {
            const balance = calculateCustomerBalance(id);
            if (parseFloat(balance) !== 0 && !confirm("This customer has a balance. Are you sure?")) return;
            const index = customersDB.findIndex(c => c.id === id);
            if (index > -1) customersDB.splice(index, 1);
        } else if (type === 'item') {
            itemsDB.splice(id, 1);
        } else if (type === 'invoice') {
            const index = invoicesDB.findIndex(i => i.invoiceNumber === id);
            if (index > -1) invoicesDB.splice(index, 1);
        } else if (type === 'receipt') {
            const index = receiptsDB.findIndex(r => r.receiptNumber === id);
            if (index > -1) receiptsDB.splice(index, 1);
        }
        renderAllLogs();
        saveAllDataToLocalStorage();
    }

    function handlePrint(type, id) {
        if (type === 'invoice') {
            const inv = invoicesDB.find(i => i.invoiceNumber === id);
            if (inv) { generateInvoicePreview(inv); document.body.className = 'printing-invoice'; window.print(); }
        } else if (type === 'receipt') {
            const rec = receiptsDB.find(r => r.receiptNumber === id);
            if (rec) { generateReceiptPreview(rec); document.body.className = 'printing-receipt'; window.print(); }
        }
    }

    // --- Initialisation ---
    function initializeApp() {
        // Load data first
        loadAllDataFromLocalStorage();

        // Setup logout button
        $('logoutBtn').addEventListener('click', () => {
            sessionStorage.removeItem('loggedInUser');
            window.location.href = 'index.html';
        });

        // Event Listeners for main actions
        $('langToggleBtn').addEventListener('click', () => setLanguage(currentLang === 'ar' ? 'en' : 'ar'));
        $('saveSettingsBtn').addEventListener('click', saveSettings);
        $('exportAllBtn').addEventListener('click', exportAllData);
        $('importAllFile').addEventListener('change', importAllData);
        $('clearAllDataBtn').addEventListener('click', clearCurrentUserData);

        $('saveCustomerBtn').addEventListener('click', saveCustomer);
        $('clearCustomerFormBtn').addEventListener('click', clearCustomerForm);
        $('saveItemBtn').addEventListener('click', saveItem);
        $('clearItemFormBtn').addEventListener('click', clearItemForm);
        $('newInvoiceBtn').addEventListener('click', clearInvoiceForm);
        $('generateBtn').addEventListener('click', saveInvoice);
        $('addItemBtn').addEventListener('click', () => addItem());
        $('newReceiptBtn').addEventListener('click', clearReceiptForm);
        $('saveReceiptBtn').addEventListener('click', saveReceipt);

        $('printInvoiceBtn').addEventListener('click', () => {
            recalcAll();
            const customerName = $("customerName").value;
            const selectedOption = Array.from($('customersDatalist').options).find(opt => opt.value === customerName);
            if (!selectedOption) { alert("Please select a customer to print."); return; }
            const formData = {
                invoiceNumber: $("invoiceNumber").value.trim() || `INV-${Date.now()}`, invoiceDate: new Date($('invoiceDate').value).toISOString(), customerCode: selectedOption.dataset.code, customerName,
                subTotal: parseFloat($("subTotal").innerText).toFixed(2), vatTotal: parseFloat($("vatTotal").innerText).toFixed(2), grandTotal: parseFloat($("grandTotal").innerText).toFixed(2),
                items: Array.from($('itemsBody').querySelectorAll('tr')).map(r => ({ description: r.querySelector('.txt-desc').value, quantity: r.querySelector('.txt-qty').value, price: r.querySelector('.txt-price').value, total: r.querySelector('.cell-line-total').innerText }))
            };
            generateInvoicePreview(formData);
            document.body.className = 'printing-invoice';
            window.print();
        });
        $('printReceiptBtn').addEventListener('click', () => {
            const customerName = $("receiptCustomerName").value;
            const selectedOption = Array.from($('customersDatalist').options).find(opt => opt.value === customerName);
            if (!selectedOption) { alert("Please select a customer to print."); return; }
            const receiptData = {
                receiptNumber: $('receiptNumber').value.trim() || `REC-${Date.now()}`, date: new Date($('receiptDate').value).toISOString(), customerCode: selectedOption.dataset.code, customerName,
                amount: parseFloat($('amountReceived').value) || 0, paymentMethod: $('paymentMethod').value, description: $('receiptDescription').value,
            };
            generateReceiptPreview(receiptData);
            document.body.className = 'printing-receipt';
            window.print();
        });

        // Event listener for dynamic content in tables
        document.body.addEventListener('click', function(e){
            const target = e.target;
            const id = target.dataset.id;
            const type = target.dataset.type;
            if (target.classList.contains('edit-btn') || target.classList.contains('delete-btn') || target.classList.contains('print-btn') || target.classList.contains('statement-btn')) {
                if (!id && id !== "0" || !type) return; // Allow for index 0
                if (target.classList.contains('edit-btn')) handleEdit(type, id);
                else if (target.classList.contains('delete-btn')) handleDelete(type, id);
                else if (target.classList.contains('print-btn')) handlePrint(type, id);
                else if (target.classList.contains('statement-btn')) {
                    generateStatementPreview(id);
                    document.body.className = 'printing-statement';
                    window.print();
                }
            }
        });

        // Customer selection listeners
        $('customerName').addEventListener('input', e => handleCustomerSelection(e, 'customerBalanceDisplay'));
        $('receiptCustomerName').addEventListener('input', e => handleCustomerSelection(e, 'receiptCustomerBalanceDisplay'));

        // Default to log view on main tab click
        const mainTabs = [
            { tab: 'invoiceTab', log: 'invoiceLog' },
            { tab: 'receiptTab', log: 'receiptLog' },
            { tab: 'itemsTab', log: 'itemLog' },
            { tab: 'customersTab', log: 'customerLog' }
        ];
        mainTabs.forEach(item => {
            const tabButton = document.querySelector(`.tab-btn[data-tab="${item.tab}"]`);
            if (tabButton) {
                tabButton.addEventListener('click', () => {
                    document.querySelector(`.sub-tab-btn[data-tab="${item.log}"]`)?.click();
                });
            }
        });

        // Final setup calls
        setupTabSwitching();
        loadSettingsForm();
        renderAllLogs();
        clearInvoiceForm();
        clearReceiptForm();
        clearCustomerForm();
        clearItemForm();
        setLanguage('ar');

        document.body.addEventListener('afterprint', () => { document.body.className = ''; });
    }

    // --- Start the Application ---
    initializeApp();
});