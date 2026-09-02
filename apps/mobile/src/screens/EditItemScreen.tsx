import type { Item } from "@wherehouse/api-client";
import {
  Check,
  Radio,
  Trash2,
  X,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader } from "../components/AppHeader";
import { ItemLocationPicker } from "../components/ItemLocationPicker";
import { ConfirmModal } from "../components/ConfirmModal";
import { QuantityStepper } from "../components/QuantityStepper";
import { useItemEdit } from "../hooks/useItemEdit";
import { styles } from "../theme/styles";
import type { ItemLocationChoice, ItemUpdateDraft } from "../types/itemDraft";
import { ItemPhotoField } from "../features/items/ItemPhotoField";

const IDENTIFIERS: { label: string; value: Item["identifier_type"] }[] = [
  { label: "Neither", value: "none" },
  { label: "QR", value: "qr" },
  { label: "NFC", value: "nfc" },
  { label: "Both", value: "both" },
];

export function EditItemScreen({
  choices,
  imageUri,
  item,
  location,
  onCancel,
  onSave,
  onArchive,
  onScanLocation,
  onWriteNfc,
  recent,
}: {
  choices: ItemLocationChoice[];
  imageUri?: string;
  item: Item;
  location?: ItemLocationChoice;
  onCancel: () => void;
  onSave: (draft: ItemUpdateDraft) => Promise<"queued" | "synced">;
  onArchive: () => Promise<void>;
  onScanLocation: () => void;
  onWriteNfc: () => Promise<void>;
  recent: ItemLocationChoice[];
}) {
  const { capturePhoto, choosePhoto, draft, update } = useItemEdit(
    item,
    location,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  async function photo(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Photo update failed.",
      );
    }
  }
  async function save() {
    if (!draft.name.trim()) return setError("Give this item a name.");
    setSaving(true);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
      onCancel();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not update this item.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function writeNfc() {
    setSaving(true);
    setError(null);
    try {
      await onWriteNfc();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not write NFC tag.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function archive() {
    setSaving(true);
    setError(null);
    try {
      await onArchive();
      setConfirmingArchive(false);
      onCancel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not archive this item.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.addItemScreen}
    >
      <View style={styles.addItemHeader}>
        <AppHeader connected />
        <View style={styles.addItemTitleRow}>
          <View>
            <Text style={styles.addItemTitle}>Edit item</Text>
            <Text style={styles.addItemSubtitle}>{item.code} · Changes require a connection</Text>
          </View>
          <Pressable
            accessibilityLabel="Close edit item"
            onPress={onCancel}
            style={styles.closeItemButton}
          >
            <X color="#667085" size={21} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.addItemContent}
        keyboardShouldPersistTaps="handled"
      >
        <ItemPhotoField emptyHint={item.image_path ? "Current image saved" : "No image yet"} onCamera={() => void photo(capturePhoto)} onLibrary={() => void photo(choosePhoto)} uri={draft.photoUri || imageUri} />
        <View style={styles.quickFields}>
          <Text style={styles.fieldLabel}>Item name</Text>
          <TextInput
            onChangeText={(name) => update({ name })}
            style={styles.itemNameInput}
            value={draft.name}
          />
          <View style={styles.quantityRow}>
            <Text style={styles.fieldLabel}>Quantity</Text>
            <QuantityStepper
              onChange={(quantity) => update({ quantity })}
              value={draft.quantity}
            />
          </View>
          <ItemLocationPicker
            choices={choices}
            onChange={(next) => update({ location: next })}
            onScan={onScanLocation}
            recent={recent}
            value={draft.location}
          />
          <Text style={styles.fieldLabel}>Physical identifier</Text>
          <View style={styles.identifierChoices}>
            {IDENTIFIERS.map((choice) => (
              <Pressable
                key={choice.value}
                onPress={() => update({ identifierType: choice.value })}
                style={[
                  styles.identifierChoice,
                  draft.identifierType === choice.value &&
                    styles.identifierChoiceActive,
                ]}
              >
                <Text
                  style={
                    draft.identifierType === choice.value
                      ? styles.identifierTextActive
                      : styles.identifierText
                  }
                >
                  {choice.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityLabel="Write NFC tag for this item"
            disabled={saving}
            onPress={() => void writeNfc()}
            style={styles.secondaryButton}
          >
            <Radio color="#4f46e5" size={18} />
            <Text style={styles.secondaryButtonText}>Write and verify NFC tag</Text>
          </Pressable>
          <TextInput
            onChangeText={(manufacturer) => update({ manufacturer })}
            placeholder="Brand"
            style={styles.secondaryInput}
            value={draft.manufacturer ?? ""}
          />
          <View style={styles.twoInputs}>
            <TextInput
              onChangeText={(model) => update({ model })}
              placeholder="Model"
              style={[styles.secondaryInput, styles.flexInput]}
              value={draft.model ?? ""}
            />
            <TextInput
              onChangeText={(serialNumber) => update({ serialNumber })}
              placeholder="Serial number"
              style={[styles.secondaryInput, styles.flexInput]}
              value={draft.serialNumber ?? ""}
            />
          </View>
          <TextInput
            multiline
            onChangeText={(description) => update({ description })}
            placeholder="Description"
            style={[styles.secondaryInput, styles.notesInput]}
            value={draft.description ?? ""}
          />
          <TextInput
            multiline
            onChangeText={(notes) => update({ notes })}
            placeholder="Notes"
            style={[styles.secondaryInput, styles.notesInput]}
            value={draft.notes ?? ""}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.addItemFooter}>
        <Pressable
          disabled={saving || !draft.name.trim()}
          onPress={() => void save()}
          style={[
            styles.saveButton,
            (!draft.name.trim() || saving) && styles.buttonDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check color="#fff" size={20} />
              <Text style={styles.saveButtonText}>Update item</Text>
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityLabel="Archive item"
          disabled={saving}
          onPress={() => setConfirmingArchive(true)}
          style={[styles.saveButton, styles.archiveButton, saving && styles.buttonDisabled]}
        >
          <Trash2 color="#fff" size={20} />
          <Text style={styles.saveButtonText}>Archive item</Text>
        </Pressable>
      </View>
      <ConfirmModal
        confirmLabel="Archive item"
        description="This removes the item from active inventory. Its record remains archived."
        destructive
        onCancel={() => setConfirmingArchive(false)}
        onConfirm={() => void archive()}
        title={`Archive ${item.name}?`}
        visible={confirmingArchive}
      />
    </KeyboardAvoidingView>
  );
}
