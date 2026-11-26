// Accepts a 20-byte hex address only. Names are refused on purpose: Rungs does not look up names (red line 9).

import { isAddress } from "@rungs/chain";
import { ArrowRight } from "lucide-react";
import { useId, useState } from "react";
import { store } from "../api";
import { navigate } from "../router";
import { S } from "../strings";

export function AddressField({ compact = false }: { compact?: boolean }) {
  const [value, setValue] = useState(() => (compact ? "" : (store.get("rungs.lastAddress") ?? "")));
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!isAddress(v)) {
      setError(S.address.refuse);
      return;
    }
    setError(null);
    store.set("rungs.lastAddress", v);
    navigate(`/line/${v}`);
  };
  return (
    <form className="addr" onSubmit={submit} aria-label="Find a line by wallet address" noValidate>
      <label htmlFor={id} className="label-text small">
        {S.address.label}
      </label>
      <div className="addr-row">
        <input
          id={id}
          name="address"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={S.address.placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <button type="submit" className={`btn btn-primary${compact ? " btn-sm" : ""}`}>
          {S.address.go}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <span id={`${id}-err`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}
