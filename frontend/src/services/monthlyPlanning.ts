import { supabase } from "@/integrations/supabase/client";

interface EncryptFn {
    (plaintext: string): Promise<string | null>;
}

interface DecryptFn {
    (ciphertext: string): Promise<string | null>;
}

interface PlanMonthOpts {
    householdId: string;
    userId: string;
    targetMonth: Date;
    previousMonth: Date;
    encrypt: EncryptFn;
    decrypt: DecryptFn;
}

interface PlanMonthResult {
    expensesPlanned: number;
    incomesPlanned: number;
}

/**
 * Pulls each row's actual amount (fallback budget, fallback legacy amount),
 * decrypts it, re-encrypts with a fresh IV, inserts as the target month's
 * `budget_amount`. Idempotent: rows already present in the target month are
 * left alone.
 */
export async function planMonth(opts: PlanMonthOpts): Promise<PlanMonthResult> {
    const { householdId, userId, targetMonth, previousMonth, encrypt, decrypt } = opts;

    const targetMonthStr = formatYearMonth(targetMonth);
    const targetMonthIso = formatIsoDate(targetMonth);
    const previousMonthIso = formatIsoDate(previousMonth);

    const expensesPlanned = await rolloverTable({
        table: "monthly_expenses",
        parentIdColumn: "expense_id",
        householdId,
        userId,
        targetMonthStr,
        targetMonthIso,
        previousMonthIso,
        encrypt,
        decrypt,
    });

    const incomesPlanned = await rolloverTable({
        table: "monthly_incomes",
        parentIdColumn: "income_source_id",
        householdId,
        userId,
        targetMonthStr,
        targetMonthIso,
        previousMonthIso,
        encrypt,
        decrypt,
    });

    return { expensesPlanned, incomesPlanned };
}

interface RolloverOpts {
    table: "monthly_expenses" | "monthly_incomes";
    parentIdColumn: "expense_id" | "income_source_id";
    householdId: string;
    userId: string;
    targetMonthStr: string;
    targetMonthIso: string;
    previousMonthIso: string;
    encrypt: EncryptFn;
    decrypt: DecryptFn;
}

async function rolloverTable(opts: RolloverOpts): Promise<number> {
    const {
        table, parentIdColumn, householdId, userId,
        targetMonthStr, targetMonthIso, previousMonthIso,
        encrypt, decrypt,
    } = opts;

    const { data: existing } = await supabase
        .from(table)
        .select(parentIdColumn)
        .eq("household_id", householdId)
        .eq("month", targetMonthIso);

    const alreadyPlanned = new Set(
        (existing ?? []).map((r: any) => r[parentIdColumn] as string),
    );

    const { data: prevRows, error: prevErr } = await supabase
        .from(table)
        .select("*")
        .eq("household_id", householdId)
        .eq("month", previousMonthIso);

    if (prevErr) throw prevErr;
    if (!prevRows || prevRows.length === 0) return 0;

    const newRows: any[] = [];
    for (const row of prevRows) {
        const parentId = row[parentIdColumn];
        if (alreadyPlanned.has(parentId)) continue;

        const carry = await readBestAmount(row, decrypt);
        if (carry === null) continue;

        const reEncrypted = await encrypt(String(carry));
        if (!reEncrypted) continue;

        newRows.push({
            household_id: householdId,
            month: targetMonthIso,
            month_start: targetMonthIso,
            month_end: targetMonthIso,
            [parentIdColumn]: parentId,
            encrypted_budget_amount: reEncrypted,
            created_by: userId,
            is_encrypted: true,
        });
    }

    if (newRows.length === 0) return 0;

    const { error: insertErr } = await supabase.from(table).insert(newRows);
    if (insertErr) throw insertErr;

    return newRows.length;
}

async function readBestAmount(row: any, decrypt: DecryptFn): Promise<number | null> {
    const candidates = [
        row.encrypted_actual_amount,
        row.encrypted_budget_amount,
        row.encrypted_amount,
    ];

    for (const ciphertext of candidates) {
        if (!ciphertext) continue;
        const plaintext = await decrypt(ciphertext);
        if (plaintext === null) continue;
        const num = Number(plaintext);
        if (!Number.isNaN(num)) return num;
    }
    return null;
}

function formatYearMonth(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function formatIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
