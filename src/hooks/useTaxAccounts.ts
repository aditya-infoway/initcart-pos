import { useEffect, useState } from "react";
import api from "../api/api";

export interface TaxAccount {
  id: number;
  system_key: string;      // PURCHASE_CGST, SALES_IGST ...
  account_name: string;
  side: "Dr" | "Cr";
}

export const useTaxAccounts = () => {
  const [accounts, setAccounts] = useState<Record<string, TaxAccount>>({});

  useEffect(() => {
    api.get("default-tax-accounts/")
      .then((r) => {
        const map: Record<string, TaxAccount> = {};
        (r.data || []).forEach((a: TaxAccount) => { map[a.system_key] = a; });
        setAccounts(map);
      })
      .catch(() => {});
  }, []);

  return accounts;
};