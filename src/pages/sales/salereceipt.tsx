import { useEffect, useState } from "react";
import api from "../../api/api";

const SaleReceipt = ({ saleId }: { saleId: number }) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get(`/sale-receipt/${saleId}/`).then(res => {
      setData(res.data);
      setTimeout(() => window.print(), 400);
    });
  }, [saleId]);

  if (!data) return null;

  return (
    <div
      style={{
        width: "58mm", // 🔥 smaller width like DMart
        margin: "0 auto",
        fontSize: "10px",
        fontFamily: "monospace",
        lineHeight: "1.2",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <b style={{ fontSize: "12px" }}>{data.branch_name}</b>
        <div>{data.address}</div>
      </div>

      <hr style={{ margin: "4px 0" }} />

      {/* Info */}
      <div>
        <div>Bill: {data.bill_no}</div>
        <div>{data.date} {data.time}</div>
        <div>{data.customer_name}</div>
        <div>{data.mobile}</div>
      </div>

      <hr style={{ margin: "4px 0" }} />

      {/* Items */}
      {data.items.map((i: any, idx: number) => (
        <div key={idx} style={{ marginBottom: "2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{i.name}</span>
            <span>₹{i.amount}</span>
          </div>
          <div style={{ fontSize: "9px" }}>
            {i.qty} x {i.rate}
          </div>
        </div>
      ))}

      <hr style={{ margin: "4px 0" }} />

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Total</span>
        <span>₹{data.total_amount}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Discount</span>
        <span>-₹{data.discount}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Tax</span>
        <span>₹{data.tax}</span>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: "bold",
          fontSize: "11px",
        }}
      >
        <span>NET</span>
        <span>₹{data.net_amount}</span>
      </div>

      <hr style={{ margin: "4px 0" }} />

      {/* Payment */}
      <div style={{ textAlign: "center" }}>
        Payment: {data.payment_mode}
      </div>

      <hr style={{ margin: "4px 0" }} />

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: "10px" }}>
        Thank You 🙏
      </div>
    </div>
  );
};

export default SaleReceipt;