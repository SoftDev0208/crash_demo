"use client";

import React from "react";
import styles from "./CrashHistory.module.css";

export default function CrashHistory(props: {
  items: number[];
  max?: number;
  rightSlot?: React.ReactNode;
}) {
  const { items, max = 20, rightSlot } = props;

  console.log("CrashHistory items:", items);

  const list = Array.isArray(items) ? items.slice(0, max) : [];

  return (
    <div className={`card ${styles.wrap}`}>
      <div className={styles.row}>
        <div className={styles.strip} aria-label="Crash history strip">
          {list.map((m, idx) => {
            const n = Number(m);
            const bg =
              n < 2
                ? "rgba(255,22,22,0.7)"
                : n < 10
                ? "rgba(34,197,94,0.7)"
                : "rgba(247,208,70,0.7)";

            return (
              <div
                key={`${n}-${idx}`}
                className={`${styles.item} mono`}
                style={{ backgroundColor: bg }}
                title={`${n.toFixed(2)}x`}
              >
                <span className={styles.dot} />
                {n.toFixed(2)}x
              </div>
            );
          })}
        </div>

        <div className={styles.right}>{rightSlot}</div>
      </div>
    </div>
  );
}
