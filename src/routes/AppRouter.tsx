import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicRoute from "./PublicRoute";
import PrivateRoute from "./PrivateRoute";
import Login from "../pages/auth/Login";
import Logout from "../pages/auth/logout";
import Dashboard from "../pages/dashboard/Dashboard";
import AccountCreationForm from "../pages/accounts/AccountCreationForm";
import AddAccount from "../pages/accounts/addAccount";
import CreateItems from "../pages/items/CreateItems";
import PurchaseEntryForm from "../pages/transactions/PurchaseEntryForm";
import PurchaseReturnForm from "../pages/transactions/PurchaseReturnForm";
import SalesEntryForm from "../pages/sales/SalesEntryForm";
// import SaleReceipt from "../pages/sales/salereceipt";
import SalesReturnForm from "../pages/sales/SalesReturnForm";
import StockReport from "../pages/reports/StockReport";
import LedgerReport from "../pages/reports/LedgerReport";
import BankPayment from "../pages/finance/BankPayment";
import BankReceipt from "../pages/finance/BankReceipt";
import CashPayment from "../pages/finance/CashPayment";
import CashReceipt from "../pages/finance/CashReceipt";
import Contra from "../pages/finance/Contra";
import JournalEntries from "../pages/finance/JournalEntries";
import DebitNoteForm from "../pages/finance/DebitNoteForm";
import CreditNoteForm from "../pages/finance/CreditNoteForm";
import Profile from "../pages/profile/Profile";
import Setting from "../pages/profile/setting";
import AddItems from "../pages/items/additem";
import Addpurchaseitem from "../pages/transactions/addpurchaseitem"
import Addsalesitem from "../pages/sales/Addsalesitem";
import PurchaseReturnList from "../pages/transactions/PurchaseReturnList";
import SalesReturnList from "../pages/sales/salesReturnList";
import WebsiteItemsList from "../pages/items/WebsiteItesList";
import WebsiteItemDetail from "../pages/items/websiteitemdetail";
import BranchOrders from "../pages/orders/branchorder";
import BranchOrderDetailPage from "../pages/orders/BranchOrderDetail";
import CreateGroup from "../pages/items/CreateGroup";
import ExcelImportExport from "../pages/items/ExcelImportExport";
import PendingBarcodes from "../pages/items/PendingBarcodes";
import BarcodesPage from "../pages/items/BarcodesPage";
import PurchaseEntryReport from "../pages/registers/PurchaseEntryReport";
import PurchaseReturnReport from "../pages/registers/PurchaseReturnReport";
import SalesEntryReport from "../pages/registers/SalesEntryReport";
import SalesReturnReport from "../pages/registers/SalesReturnReport";
import CashBook from "../pages/books/Cashbook";
import BankBook from "../pages/books/BankBook";
import DayBook from "../pages/books/DayBook";
import OutstandingReport from "../pages/reports/OutStandingReports";
import DuePaymentReport from "../pages/reports/DuePaymentreport";
import LedgerDetail from "../pages/reports/LedgerDetails";
import StockDetail from "../pages/reports/StockDetails";
import StockTransfer from "../pages/transactions/Stocktransfer";
import StockVerification from "../pages/transactions/StockVarification";
import SalesEntryForm2 from "../pages/sales/SalesEntryForm2";
import SalesProfitReport from "../pages/registers/SalesProfitReport";
import BranchOrderRequest from "../pages/transactions/BranchOrderRequest";
import StockReturnManagement from "../pages/transactions/stockmanagement";
import StockReturn from "../pages/transactions/stockreturn";
// import AccountCreationForm from "../pages/accounts/AccountCreationForm";

const AppRouter = () => (
  <BrowserRouter basename="/pos">
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      {/* Private Routes */}
      <Route element={<PrivateRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/accounts" element={<AccountCreationForm />} />
        <Route path="/addAccounts" element={<AddAccount />} />
        <Route path="/accounts/edit/:id" element={<AccountCreationForm />} />
        <Route path="/items" element={<CreateItems />} />
        <Route path="/purchases" element={<PurchaseEntryForm />} />
        <Route path="/Addpurchaseitem" element={<Addpurchaseitem />} />
        <Route path="/Addsalesitem" element={<Addsalesitem />} />
        <Route path="/purchase-return" element={<PurchaseReturnForm />} />
        <Route path="/purchaseReturnList" element={<PurchaseReturnList/>}/>
        <Route path="/sales" element={<SalesEntryForm />} />
        <Route path="/sales-return" element={<SalesReturnForm />} />
        <Route path="salesReturnList" element={<SalesReturnList/>}/>
        <Route path="/stock-report" element={<StockReport />} />
        <Route path="/ledger-report" element={<LedgerReport />} />
        <Route path="/Bank-payment" element={<BankPayment />} />
        <Route path="/Bank-receipt" element={<BankReceipt />} />
        <Route path="/Cash-Payment" element={<CashPayment />} />
        <Route path="/Cash-receipt" element={<CashReceipt />} />
        <Route path="/Contra" element={<Contra />} />
        <Route path="/JournalEntries" element={<JournalEntries />} />
        <Route path="/debit-note" element={<DebitNoteForm />} />
        <Route path="/credit-note" element={<CreditNoteForm />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/Setting" element={<Setting />} />
        <Route path="/AddItems" element={<AddItems />} />
        <Route path="/website-items/:id/edit" element={<WebsiteItemDetail />} />
        <Route path="/website-items/:id" element={<WebsiteItemDetail />} />
        <Route path="/WebItems" element={<WebsiteItemsList/>}/>
        <Route path="/Orders" element={<BranchOrders/>}/>
        <Route path="/branch/orders/:orderId" element={<BranchOrderDetailPage/>} />
        <Route path="/createGroup" element={<CreateGroup/>}/>
        <Route path="/ExcelImportExport" element={<ExcelImportExport/>}/>
        <Route path="/items/:id/edit" element={<CreateItems />} />
        <Route path="/pendingBarcodes" element={<PendingBarcodes/>} />
        <Route path="/barcodes" element={<BarcodesPage />} />
        <Route path="/purchaseRegister" element={<PurchaseEntryReport/>}/>
        <Route path="/purchaseReturnRegister" element={<PurchaseReturnReport/>}/>
        <Route path="/salesEntryRegister" element={<SalesEntryReport/>}/>
        <Route path="/salesReturnRegister" element={<SalesReturnReport/>}/>
        <Route path="/cashBook" element={<CashBook/>}/>
        <Route path="/bankBook" element={<BankBook/>}/>
        <Route path="/dayBook" element={<DayBook/>}/>
        <Route path="/outStandingReport" element={<OutstandingReport/>}/>
        <Route path="/duePaymentReport" element={<DuePaymentReport/>}/>
        <Route path="/ledger-detail/:accountId" element={<LedgerDetail />} />
        <Route path="/stockDetail/:variantId" element={<StockDetail/>}/>
        <Route path="/stockTransfer" element={<StockTransfer/>}/>
        <Route path="/stock-verification" element={<StockVerification />} />
        <Route path="/salesentry2" element={<SalesEntryForm2/>}/>
        <Route path="/salesProfitReport" element={<SalesProfitReport/>}/>
        <Route path="/order-items" element={<BranchOrderRequest/>}/>
        <Route path="/stockReturnverification" element={<StockReturnManagement/>}/>
        <Route path="/stockReturn" element={<StockReturn/>}/>
        {/* <Route path="/productcategory" element={<ProductCategory />} />
        <Route path="/servicecategory" element={<ServiceCategory />} />
        <Route path="/productvendor" element={<ProductVendor />} />
        <Route path="/servicevendor" element={<ServiceVendor />} />
        <Route path="/servicevendorrequests" element={<ServiceVendorRequests />} />
        <Route path="/productvendorrequests" element={<ProductVendorRequests />} />
        <Route path="/subcategory" element={<SubCategory />} />
        <Route path="/subsubcategory" element={<SubSubCategory />} />
        <Route path="/allorders" element={<All />} />
        <Route path="/pendingorders" element={<Pending />} />
        <Route path="/confirmedorders" element={<Confirmed />} />
        <Route path="/packagingorders" element={<Packaging />} />
        <Route path="/outfordeliveryorders" element={<OutForDelivery />} />
        <Route path="/deliveredorders" element={<Delivered />} />
        <Route path="/returnedorders" element={<Returned />} />
        <Route path="/failedtodeliverorders" element={<FailedToDeliver />} />
        <Route path="/cancelledorders" element={<Cancelled />} /> */}

        {/* Add more protected routes */}
      </Route>

      {/* <Route path="*" element={<NotFound />} /> <==== ADD LATER */}
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
