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
import BranchMaster from "../pages/accounts/BranchMaster";
import B2BOrderRequest from "../pages/transactions/B2BorderRequest";
import B2BStockTransfer from "../pages/transactions/B2BStockTransfer";
import SchemeOfferManagement from "../pages/scheme/SuperadminScheme";
import SchemeReportPage from "../pages/scheme/SchemeReport";
import MySchemeReportPage from "../pages/scheme/MyschemereportPage";
import MySchemeOffers from "../pages/scheme/MySchemeOffers";
import B2BStockReturn from "../pages/transactions/B2BStockReturn";
import B2BStockReturnManagement from "../pages/transactions/B2BStockReturnManagement";
import B2BSales from "../pages/transactions/B2BSales";
import B2BSalesVerify from "../pages/transactions/B2BSalesVerify";
import B2BSalesList from "../pages/transactions/B2BSalesList";
import EmployeeList from "../pages/Employees/EployeeList";
import EmployeeForm from "../pages/Employees/EmployeeForm";
import EmployeePermissions from "../pages/Employees/EmployeePermissions";
import AIPurchaseBill from "../pages/AI/AIPurchaseBill";
import PurchaseExcelImportExport from "../pages/transactions/PurchaseExcelImportExport_1";
import MyBranches from "../pages/accounts/MyBranches";



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
        <Route path="/branchMaster" element={<BranchMaster/>}/>
        <Route path="/B2BOrderRequest" element={<B2BOrderRequest/>}/>
        <Route path="/B2BStockTransfer" element={<B2BStockTransfer/>}/>
        <Route path="/SchemeOffer" element={<SchemeOfferManagement/>}/>
        <Route path="/SchemeOffers/:id/report" element={<SchemeReportPage />} />
        <Route path="/SchemeOfferRegister" element={<MySchemeOffers/>}/>
        <Route path="/SchemeOfferRegister/:id/report" element={<MySchemeReportPage />} />

        <Route path="/b2bstockReturnverification" element={<B2BStockReturnManagement/>}/>
        <Route path="/b2bstockReturn" element={<B2BStockReturn/>}/>
        <Route path="/b2bsales" element={<B2BSalesList/>}/>
        <Route path="/b2bsalescreate" element={<B2BSales/>}/>
        <Route path="/b2bpurchaseverify" element={<B2BSalesVerify/>}/>
        
        <Route path="/allEmployees" element={<EmployeeList/>}/>
        <Route path="/Employees" element={<EmployeeForm/>}/>
        <Route path="/Employees/edit/:id/" element={<EmployeeForm/>}/>
        <Route path="/employees/:id/permissions" element={<EmployeePermissions/>}/>

        <Route path="/aipurchasebill" element={<AIPurchaseBill/>}/>
        <Route path="/purchaseimport" element={<PurchaseExcelImportExport/>}/>
        <Route path="/myBranches" element={<MyBranches />} />

      </Route>

    </Routes>
  </BrowserRouter>
);

export default AppRouter;
