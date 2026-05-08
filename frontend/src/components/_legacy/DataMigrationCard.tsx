/**
 * DataMigrationCard Component
 * 
 * One-time migration tool to encrypt existing plaintext data.
 * This must run client-side because encryption uses the user's DEK
 * which is only available in the browser after vault unlock.
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, AlertTriangle, Loader2, Database, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { getActiveHousehold } from "@/utils/householdHelpers";
import { toast } from "sonner";

interface MigrationStatus {
    table: string;
    total: number;
    migrated: number;
    status: "pending" | "running" | "done" | "error";
    error?: string;
}

interface TableConfig {
    table: string;
    displayName: string;
    fields: { original: string; encrypted: string }[];
    householdFilter?: boolean;
}

const TABLES_TO_MIGRATE: TableConfig[] = [
    {
        table: "income_sources",
        displayName: "Income Sources",
        fields: [
            { original: "name", encrypted: "encrypted_name" },
            { original: "default_amount", encrypted: "encrypted_default_amount" },
        ],
        householdFilter: true,
    },
    {
        table: "expenses",
        displayName: "Expenses",
        fields: [
            { original: "name", encrypted: "encrypted_name" },
            { original: "default_amount", encrypted: "encrypted_default_amount" },
        ],
        householdFilter: true,
    },
    {
        table: "monthly_incomes",
        displayName: "Monthly Incomes",
        fields: [{ original: "amount", encrypted: "encrypted_amount" }],
        householdFilter: true,
    },
    {
        table: "monthly_expenses",
        displayName: "Monthly Expenses",
        fields: [{ original: "amount", encrypted: "encrypted_amount" }],
        householdFilter: true,
    },
    {
        table: "subscriptions",
        displayName: "Subscriptions",
        fields: [
            { original: "name", encrypted: "encrypted_name" },
            { original: "amount", encrypted: "encrypted_amount" },
        ],
        householdFilter: true,
    },
    {
        table: "insurances",
        displayName: "Insurances",
        fields: [
            { original: "name", encrypted: "encrypted_name" },
            { original: "total_amount", encrypted: "encrypted_total_amount" },
            { original: "provider", encrypted: "encrypted_provider" },
        ],
        householdFilter: true,
    },
    {
        table: "savings_goals",
        displayName: "Savings Goals",
        fields: [
            { original: "name", encrypted: "encrypted_name" },
            { original: "target_amount", encrypted: "encrypted_target_amount" },
            { original: "current_amount", encrypted: "encrypted_current_amount" },
        ],
        householdFilter: true,
    },
    {
        table: "shared_expenses",
        displayName: "Shared Expenses",
        fields: [
            { original: "description", encrypted: "encrypted_description" },
            { original: "amount", encrypted: "encrypted_amount" },
        ],
        householdFilter: true,
    },
    // credit_card_expenses removed - table dropped, credit expenses now use expenses.is_credit
    {
        table: "credit_cards",
        displayName: "Credit Cards",
        fields: [
            { original: "name", encrypted: "encrypted_name" },
            { original: "monthly_limit", encrypted: "encrypted_monthly_limit" },
        ],
        householdFilter: true,
    },
];

export const DataMigrationCard = () => {
    const { user } = useAuth();
    const { encrypt, isUnlocked } = useEncryption();
    const [householdId, setHouseholdId] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const [migrationStatus, setMigrationStatus] = useState<MigrationStatus[]>([]);
    const [totalUnencrypted, setTotalUnencrypted] = useState(0);
    const [hasScanned, setHasScanned] = useState(false);

    useEffect(() => {
        const loadHousehold = async () => {
            if (!user) return;
            const { membership } = await getActiveHousehold(user.id);
            if (membership) {
                setHouseholdId(membership.household_id);
            }
        };
        loadHousehold();
    }, [user]);

    const scanForUnencryptedData = async () => {
        if (!householdId) return;

        setScanning(true);
        const statuses: MigrationStatus[] = [];
        let total = 0;

        for (const config of TABLES_TO_MIGRATE) {
            // Check for records where ANY plaintext field still has a value
            // This catches both unencrypted records AND records with leftover plaintext
            const firstField = config.fields[0].original;

            let query = (supabase as any)
                .from(config.table)
                .select("id", { count: "exact" })
                .not(firstField, "is", null);

            if (config.householdFilter) {
                query = query.eq("household_id", householdId);
            }

            const { count, error } = await query;

            const recordCount = error ? 0 : (count || 0);
            total += recordCount;

            statuses.push({
                table: config.table,
                total: recordCount,
                migrated: 0,
                status: recordCount > 0 ? "pending" : "done",
            });
        }

        setMigrationStatus(statuses);
        setTotalUnencrypted(total);
        setHasScanned(true);
        setScanning(false);
    };

    const migrateTable = async (config: TableConfig, statusIndex: number) => {
        if (!householdId) return;

        // Update status to running
        setMigrationStatus((prev) => {
            const updated = [...prev];
            updated[statusIndex] = { ...updated[statusIndex], status: "running" };
            return updated;
        });

        try {
            // Fetch records where plaintext fields still have values
            const firstField = config.fields[0].original;

            let query = (supabase as any)
                .from(config.table)
                .select("*")
                .not(firstField, "is", null);

            if (config.householdFilter) {
                query = query.eq("household_id", householdId);
            }

            const { data: records, error: fetchError } = await query;

            if (fetchError) throw fetchError;
            if (!records || records.length === 0) {
                setMigrationStatus((prev) => {
                    const updated = [...prev];
                    updated[statusIndex] = { ...updated[statusIndex], status: "done" };
                    return updated;
                });
                return;
            }

            // Encrypt each record
            let migrated = 0;
            for (const record of records) {
                const updateData: Record<string, any> = { is_encrypted: true };

                // Encrypt each field
                for (const field of config.fields) {
                    const value = record[field.original];
                    if (value !== undefined && value !== null) {
                        const encryptedValue = await encrypt(String(value));
                        if (encryptedValue) {
                            updateData[field.encrypted] = encryptedValue;
                            // Clear plaintext field for maximum security
                            updateData[field.original] = null;
                        }
                    }
                }

                // Update the record
                const { error: updateError } = await (supabase as any)
                    .from(config.table)
                    .update(updateData)
                    .eq("id", record.id);

                if (updateError) {
                    console.error(`Failed to migrate record ${record.id} in ${config.table}:`, updateError);
                } else {
                    migrated++;
                    setMigrationStatus((prev) => {
                        const updated = [...prev];
                        updated[statusIndex] = { ...updated[statusIndex], migrated };
                        return updated;
                    });
                }
            }

            setMigrationStatus((prev) => {
                const updated = [...prev];
                updated[statusIndex] = { ...updated[statusIndex], status: "done", migrated };
                return updated;
            });
        } catch (error: any) {
            console.error(`Error migrating ${config.table}:`, error);
            setMigrationStatus((prev) => {
                const updated = [...prev];
                updated[statusIndex] = { ...updated[statusIndex], status: "error", error: error.message };
                return updated;
            });
        }
    };

    const runMigration = async () => {
        if (!isUnlocked) {
            toast.error("Please unlock your vault first");
            return;
        }

        setMigrating(true);

        for (let i = 0; i < TABLES_TO_MIGRATE.length; i++) {
            const status = migrationStatus[i];
            if (status.total > 0 && status.status === "pending") {
                await migrateTable(TABLES_TO_MIGRATE[i], i);
            }
        }

        setMigrating(false);
        toast.success("Data migration complete!");
    };

    const totalMigrated = migrationStatus.reduce((sum, s) => sum + s.migrated, 0);
    const allDone = migrationStatus.every((s) => s.status === "done");
    const progress = totalUnencrypted > 0 ? (totalMigrated / totalUnencrypted) * 100 : 0;



    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Data Migration
                </CardTitle>
                <CardDescription>
                    Encrypt existing plaintext data for maximum security
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!hasScanned ? (
                    <>
                        <Alert>
                            <Database className="h-4 w-4" />
                            <AlertTitle>One-Time Migration</AlertTitle>
                            <AlertDescription>
                                This tool will encrypt any existing plaintext data in your database.
                                After migration, all sensitive data will be encrypted at rest.
                            </AlertDescription>
                        </Alert>
                        <Button onClick={scanForUnencryptedData} disabled={scanning} className="w-full">
                            {scanning ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Scanning...
                                </>
                            ) : (
                                <>
                                    <Database className="h-4 w-4 mr-2" />
                                    Scan for Unencrypted Data
                                </>
                            )}
                        </Button>
                    </>
                ) : totalUnencrypted === 0 ? (
                    <Alert variant="success">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>All Data Encrypted</AlertTitle>
                        <AlertDescription>
                            Congratulations! All your data is already encrypted.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Migration Progress</span>
                                <span>{totalMigrated} / {totalUnencrypted} records</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>

                        <div className="space-y-2 text-sm">
                            {migrationStatus.map((status) => (
                                status.total > 0 && (
                                    <div key={status.table} className="flex items-center justify-between py-1">
                                        <span className="flex items-center gap-2">
                                            {status.status === "running" && (
                                                <Loader2 className="h-3 w-3 animate-spin text-info" />
                                            )}
                                            {status.status === "done" && (
                                                <CheckCircle2 className="h-3 w-3 text-success" />
                                            )}
                                            {status.status === "error" && (
                                                <AlertTriangle className="h-3 w-3 text-destructive" />
                                            )}
                                            {status.status === "pending" && (
                                                <Database className="h-3 w-3 text-muted-foreground" />
                                            )}
                                            {TABLES_TO_MIGRATE.find(t => t.table === status.table)?.displayName}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {status.migrated}/{status.total}
                                        </span>
                                    </div>
                                )
                            ))}
                        </div>

                        {!allDone && (
                            <Button
                                onClick={runMigration}
                                disabled={migrating}
                                className="w-full"
                                variant={migrating ? "outline" : "default"}
                            >
                                {migrating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Encrypting...
                                    </>
                                ) : (
                                    <>
                                        <Shield className="h-4 w-4 mr-2" />
                                        Encrypt {totalUnencrypted} Records
                                    </>
                                )}
                            </Button>
                        )}

                        {allDone && (
                            <Alert variant="success">
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertTitle>Migration Complete</AlertTitle>
                                <AlertDescription>
                                    All {totalMigrated} records have been encrypted successfully.
                                </AlertDescription>
                            </Alert>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
};
