import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface TabCrudConfig<T> {
  tableName: string;
  householdId: string;
  defaultFormData: T;
  orderBy?: string;
  toastMessages?: {
    add?: string;
    update?: string;
    delete?: string;
    fetchError?: string;
    saveError?: string;
    deleteError?: string;
  };
  additionalFetchTables?: Array<{
    name: string;
    columns: string;
    filter?: { column: string; value: string };
  }>;
  transformDataBeforeSave?: (data: T, userId: string, householdId: string, editingId: string | null) => any;
  transformDataOnEdit?: (item: any) => T;
}

export interface TabCrudReturn<T> {
  items: any[];
  additionalData: Record<string, any[]>;
  loading: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  editingId: string | null;
  formData: T;
  setFormData: (data: T | ((prev: T) => T)) => void;
  handleSave: () => Promise<void>;
  handleEdit: (item: any) => void;
  handleDelete: (id: string) => Promise<void>;
  resetForm: () => void;
  fetchItems: () => Promise<void>;
  activeItems: any[];
  inactiveItems: any[];
}

export const useTabCrud = <T extends Record<string, any>>(
  config: TabCrudConfig<T>
): TabCrudReturn<T> => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [additionalData, setAdditionalData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<T>(config.defaultFormData);

  const {
    tableName,
    householdId,
    defaultFormData,
    orderBy = "name",
    toastMessages = {},
    additionalFetchTables = [],
    transformDataBeforeSave,
    transformDataOnEdit,
  } = config;

  const fetchItems = async () => {
    const promises = [
      supabase
        .from(tableName)
        .select("*")
        .eq("household_id", householdId)
        .order(orderBy),
    ];

    // Fetch additional tables if specified
    additionalFetchTables.forEach((table) => {
      let query = supabase.from(table.name).select(table.columns);

      if (table.filter) {
        query = query.eq(table.filter.column, table.filter.value);
      } else {
        // Default to household_id filter if no custom filter
        query = query.eq("household_id", householdId);
      }

      promises.push(query);
    });

    const results = await Promise.all(promises);

    setItems(results[0].data || []);

    // Store additional data in a map by table name
    const additionalDataMap: Record<string, any[]> = {};
    additionalFetchTables.forEach((table, index) => {
      additionalDataMap[table.name] = results[index + 1].data || [];
    });
    setAdditionalData(additionalDataMap);

    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!user) return;

    // Transform data before save if transformer provided
    const data = transformDataBeforeSave
      ? transformDataBeforeSave(formData, user.id, householdId, editingId)
      : {
        household_id: householdId,
        ...formData,
        created_by: user.id,
      };

    let error;
    if (editingId) {
      ({ error } = await supabase.from(tableName).update(data).eq("id", editingId));
    } else {
      ({ error } = await supabase.from(tableName).insert(data));
    }

    if (error) {
      toast({
        title: "Error",
        description: toastMessages.saveError || "Failed to save item",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: editingId
          ? toastMessages.update || "Item updated"
          : toastMessages.add || "Item added",
      });
      setIsOpen(false);
      resetForm();
      fetchItems();
    }
  };

  const handleEdit = (item: any) => {
    // Transform data on edit if transformer provided
    const editData = transformDataOnEdit ? transformDataOnEdit(item) : item;
    setFormData(editData);
    setEditingId(item.id);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from(tableName).delete().eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: toastMessages.deleteError || "Failed to delete item",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: toastMessages.delete || "Item deleted",
      });
      fetchItems();
    }
  };

  // Split items into active and inactive if they have is_active field
  const activeItems = items.filter((item) => item.is_active ?? true);
  const inactiveItems = items.filter((item) => item.is_active === false);

  return {
    items,
    additionalData,
    loading,
    isOpen,
    setIsOpen,
    editingId,
    formData,
    setFormData,
    handleSave,
    handleEdit,
    handleDelete,
    resetForm,
    fetchItems,
    activeItems,
    inactiveItems,
  };
};
