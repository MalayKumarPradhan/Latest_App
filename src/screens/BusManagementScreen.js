import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, IconButton, Menu, RadioButton, Switch, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import {
  createManagedBus,
  fetchManagedBuses,
  fetchManagedOperators,
  updateManagedBus,
  uploadManagedBusImage,
} from '../services/api';

const BUS_TYPES = [
  'AC Sleeper',
  'Non-AC Sleeper',
  'AC Seater',
  'Non-AC Seater',
  'AC Semi-Sleeper',
];

const emptyForm = {
  operatorId: null,
  busNumber: '',
  busType: 'AC Seater',
  totalCapacity: '40',
  hasUpperDeck: false,
  seatsPerRowLeft: '2',
  seatsPerRowRight: '2',
  seatRowCount: '10',
  driverSide: 'Right',
  busImageUrl: '',
  isActive: false,
};

function getError(error, fallback) {
  return error.response?.data?.error || error.message || fallback;
}

export default function BusManagementScreen({ navigation }) {
  const { user } = useAuth();
  const [buses, setBuses] = useState([]);
  const [operators, setOperators] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busNumberFilter, setBusNumberFilter] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [busTypeFilter, setBusTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [operatorMenuVisible, setOperatorMenuVisible] = useState(false);
  const [busTypeMenuVisible, setBusTypeMenuVisible] = useState(false);
  const [driverMenuVisible, setDriverMenuVisible] = useState(false);
  const [filterOperatorMenuVisible, setFilterOperatorMenuVisible] = useState(false);
  const [filterTypeMenuVisible, setFilterTypeMenuVisible] = useState(false);
  const [busImageUri, setBusImageUri] = useState('');
  const [imageLoadError, setImageLoadError] = useState(false);

  const loadBuses = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const [data, operatorOptions] = await Promise.all([
        fetchManagedBuses(),
        fetchManagedOperators(),
      ]);
      const normalizedOperators = operatorOptions.map((operator) => ({
        ...operator,
        operatorId: Number(operator.operatorId),
      }));
      const normalizedBuses = data.items.map((bus) => ({
        ...bus,
        operatorId: Number(bus.operatorId),
      }));
      setBuses(normalizedBuses);
      setOperators(normalizedOperators);
      setForm((current) => {
        if (current.operatorId && normalizedOperators.some((operator) =>
          operator.operatorId === Number(current.operatorId)
        )) return current;
        if (normalizedOperators.length === 0) return { ...current, operatorId: null };
        return { ...current, operatorId: normalizedOperators[0].operatorId };
      });
    } catch (requestError) {
      setError(getError(requestError, 'Could not load buses.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadBuses();
  }, [loadBuses]));

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const chooseBusImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo library access to upload a bus image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setBusImageUri(result.assets[0].uri);
      setImageLoadError(false);
      setError('');
    }
  };

  const resetForm = () => {
    setForm({
      ...emptyForm,
      operatorId: operators.length ? operators[0].operatorId : null,
    });
    setEditingId(null);
    setBusImageUri('');
    setImageLoadError(false);
    setMessage('');
  };

  const openAddForm = () => {
    resetForm();
    setError('');
    setFormVisible(true);
  };

  const closeForm = () => {
    resetForm();
    setError('');
    setFormVisible(false);
  };

  const editBus = (bus) => {
    setEditingId(bus.busId);
    setFormVisible(true);
    setError('');
    setMessage('');
    setForm({
      operatorId: bus.operatorId,
      busNumber: bus.busNumber,
      busType: bus.busType,
      totalCapacity: String(bus.totalCapacity),
      hasUpperDeck: Boolean(bus.hasUpperDeck),
      seatsPerRowLeft: String(bus.seatsPerRowLeft ?? 2),
      seatsPerRowRight: String(bus.seatsPerRowRight ?? 2),
      seatRowCount: String(bus.seatRowCount ?? 10),
      driverSide: bus.driverSide || 'Right',
      busImageUrl: bus.busImageUrl || '',
      isActive: Boolean(bus.isActive),
    });
    setBusImageUri('');
    setImageLoadError(false);
  };

  const saveBus = async () => {
    setError('');
    setMessage('');
    const totalCapacity = Number(form.totalCapacity);
    const seatsPerRowLeft = Number(form.seatsPerRowLeft);
    const seatsPerRowRight = Number(form.seatsPerRowRight);
    const seatRowCount = Number(form.seatRowCount);
    if (!form.operatorId || !form.busNumber.trim() || !Number.isInteger(totalCapacity) || totalCapacity < 1) {
      setError('Choose an operator, enter a bus number, and enter a valid capacity.');
      return;
    }
    if (!/^\d+$/.test(form.seatRowCount) || seatRowCount < 1 || seatRowCount > 15) {
      setError('Seat row count must be between 1 and 15.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        operatorId: Number(form.operatorId),
        busNumber: form.busNumber.trim(),
        busType: form.busType,
        totalCapacity,
        hasUpperDeck: form.hasUpperDeck,
        seatsPerRowLeft,
        seatsPerRowRight,
        seatRowCount,
        driverSide: form.driverSide,
        busImageUrl: form.busImageUrl.trim() || null,
        isActive: form.isActive,
      };
      const successMessage = editingId ? 'Bus updated.' : 'Bus added.';
      let savedBusId = editingId;
      if (editingId) {
        await updateManagedBus(editingId, payload);
      } else {
        const created = await createManagedBus(payload);
        savedBusId = created.data?.busId;
      }
      if (busImageUri && savedBusId) {
        const uploaded = await uploadManagedBusImage(savedBusId, busImageUri);
        setForm((current) => ({ ...current, busImageUrl: uploaded.busImageUrl }));
      }
      resetForm();
      setFormVisible(false);
      setMessage(successMessage);
      await loadBuses(false);
    } catch (requestError) {
      setError(getError(requestError, 'Could not save the bus.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (bus) => {
    const activating = !Boolean(bus.isActive);
    const performUpdate = async () => {
      setSaving(true);
      setError('');
      try {
        await updateManagedBus(bus.busId, { isActive: activating });
        setMessage(`Bus ${bus.busNumber} ${activating ? 'activated' : 'deactivated'}.`);
        await loadBuses(false);
      } catch (requestError) {
        setError(getError(requestError, 'Could not update bus status.'));
      } finally {
        setSaving(false);
      }
    };

    if (activating) {
      await performUpdate();
      return;
    }

    Alert.alert(
      'Deactivate bus?',
      `Deactivate ${bus.busNumber}? This is blocked if the bus has future journeys or confirmed bookings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: performUpdate },
      ]
    );
  };

  const filteredBuses = useMemo(() => buses.filter((bus) => {
    const numberQuery = busNumberFilter.trim().toLowerCase();
    return (!numberQuery || bus.busNumber.toLowerCase().includes(numberQuery)) &&
      (!operatorFilter || bus.operatorId === operatorFilter) &&
      (!busTypeFilter || bus.busType === busTypeFilter) &&
      (!statusFilter ||
        (statusFilter === 'ACTIVE' ? Boolean(bus.isActive) : !Boolean(bus.isActive)));
  }), [busNumberFilter, busTypeFilter, buses, operatorFilter, statusFilter]);

  const selectedOperator = operators.find((operator) => operator.operatorId === form.operatorId);
  const selectedFilterOperator = operators.find((operator) => operator.operatorId === operatorFilter);
  const imagePreviewUri = busImageUri || form.busImageUrl.trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            mode="contained-tonal"
            onPress={() => (formVisible ? closeForm() : navigation.goBack())}
            accessibilityLabel={formVisible ? 'Back to bus list' : 'Back'}
          />
          <View style={styles.heading}>
            <Text variant="labelLarge" style={styles.eyebrow}>
              {user?.role === 'SystemAdmin' ? 'SYSTEM ADMIN' : 'BUS OPERATOR'}
            </Text>
            <Text variant="headlineSmall" style={styles.title}>
              {formVisible ? (editingId ? 'Edit bus' : 'Add new bus') : 'Manage buses'}
            </Text>
          </View>
          {!formVisible ? (
            <IconButton icon="refresh" onPress={() => loadBuses()} disabled={loading || saving} />
          ) : <View style={styles.headerActionPlaceholder} />}
        </View>

        {error ? <Card style={styles.errorCard}><Card.Content><Text style={styles.errorText}>{error}</Text></Card.Content></Card> : null}
        {message ? <Card style={styles.messageCard}><Card.Content><Text style={styles.messageText}>{message}</Text></Card.Content></Card> : null}

        {formVisible ? (
        <Card style={styles.formCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>{editingId ? 'Edit bus' : 'Add bus'}</Text>
            <Menu visible={operatorMenuVisible} onDismiss={() => setOperatorMenuVisible(false)}
              anchor={<Button mode="outlined" icon="chevron-down" onPress={() => setOperatorMenuVisible(true)}
                style={styles.fieldButton} disabled={!operators.length}>
                {selectedOperator?.operatorName || 'Select operator'}
              </Button>}>
              {operators.map((operator) => (
                <Menu.Item key={operator.operatorId} title={operator.operatorName}
                  onPress={() => { updateField('operatorId', operator.operatorId); setOperatorMenuVisible(false); }} />
              ))}
            </Menu>
            <TextInput label="Bus number" value={form.busNumber} onChangeText={(value) => updateField('busNumber', value)}
              mode="outlined" style={styles.input} />
            <Menu visible={busTypeMenuVisible} onDismiss={() => setBusTypeMenuVisible(false)}
              anchor={<Button mode="outlined" icon="chevron-down" onPress={() => setBusTypeMenuVisible(true)} style={styles.fieldButton}>
                {form.busType}
              </Button>}>
              {BUS_TYPES.map((type) => (
                <Menu.Item key={type} title={type}
                  onPress={() => { updateField('busType', type); setBusTypeMenuVisible(false); }} />
              ))}
            </Menu>
            <View style={styles.row}>
              <TextInput label="Total capacity" value={form.totalCapacity} onChangeText={(value) => updateField('totalCapacity', value)}
                keyboardType="number-pad" mode="outlined" style={[styles.input, styles.halfInput]} />
              <TextInput label="Seat rows" value={form.seatRowCount} onChangeText={(value) => updateField('seatRowCount', value)}
                keyboardType="number-pad" mode="outlined" style={[styles.input, styles.halfInput]} />
            </View>
            <View style={styles.row}>
              <TextInput label="Seats left" value={form.seatsPerRowLeft} onChangeText={(value) => updateField('seatsPerRowLeft', value)}
                keyboardType="number-pad" mode="outlined" style={[styles.input, styles.halfInput]} />
              <TextInput label="Seats right" value={form.seatsPerRowRight} onChangeText={(value) => updateField('seatsPerRowRight', value)}
                keyboardType="number-pad" mode="outlined" style={[styles.input, styles.halfInput]} />
            </View>
            <Menu visible={driverMenuVisible} onDismiss={() => setDriverMenuVisible(false)}
              anchor={<Button mode="outlined" icon="chevron-down" onPress={() => setDriverMenuVisible(true)} style={styles.fieldButton}>
                Driver side: {form.driverSide}
              </Button>}>
              {['Left', 'Right'].map((side) => (
                <Menu.Item key={side} title={side}
                  onPress={() => { updateField('driverSide', side); setDriverMenuVisible(false); }} />
              ))}
            </Menu>
            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Upper deck</Text>
              <Switch value={form.hasUpperDeck} onValueChange={(value) => updateField('hasUpperDeck', value)} />
            </View>
            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Active bus</Text>
              <RadioButton.Group
                onValueChange={(value) => updateField('isActive', value === 'active')}
                value={form.isActive ? 'active' : 'inactive'}
              >
                <View style={styles.radioRow}>
                  <View style={styles.radioOption}>
                    <RadioButton value="active" />
                    <Text variant="bodySmall">Active</Text>
                  </View>
                  <View style={styles.radioOption}>
                    <RadioButton value="inactive" />
                    <Text variant="bodySmall">Inactive</Text>
                  </View>
                </View>
              </RadioButton.Group>
            </View>
            <Button
              mode="outlined"
              icon="image-plus"
              onPress={chooseBusImage}
              style={styles.fieldButton}
            >
              {busImageUri || form.busImageUrl ? 'Change bus image' : 'Upload bus image'}
            </Button>
            <View style={styles.imagePreviewSection}>
              <Text variant="labelMedium" style={styles.imagePreviewLabel}>Bus image preview</Text>
              {imagePreviewUri && !imageLoadError ? (
              <Image
                key={imagePreviewUri}
                source={{ uri: imagePreviewUri }}
                style={styles.preview}
                resizeMode="cover"
                onError={() => setImageLoadError(true)}
              />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text variant="bodySmall" style={styles.imagePlaceholderText}>
                    {imageLoadError ? 'Image could not be loaded. Upload another image.' : 'No bus image uploaded.'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.formActions}>
              <Button mode="outlined" onPress={closeForm} disabled={saving}>Cancel</Button>
              <Button mode="contained" onPress={saveBus} loading={saving} disabled={saving || loading}>
                {editingId ? 'Update bus' : 'Add bus'}
              </Button>
            </View>
          </Card.Content>
        </Card>
        ) : (
        <>
        <Card style={styles.filterCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Filter buses</Text>
            <TextInput label="Bus number" value={busNumberFilter} onChangeText={setBusNumberFilter}
              mode="outlined" style={styles.input} />
            <Menu visible={filterOperatorMenuVisible} onDismiss={() => setFilterOperatorMenuVisible(false)}
              anchor={<Button mode="outlined" icon="chevron-down" onPress={() => setFilterOperatorMenuVisible(true)}
                style={styles.fieldButton}>
                {selectedFilterOperator?.operatorName || 'All operators'}
              </Button>}>
              <Menu.Item title="All operators" onPress={() => { setOperatorFilter(''); setFilterOperatorMenuVisible(false); }} />
              {operators.map((operator) => (
                <Menu.Item key={operator.operatorId} title={operator.operatorName}
                  onPress={() => { setOperatorFilter(operator.operatorId); setFilterOperatorMenuVisible(false); }} />
              ))}
            </Menu>
            <Menu visible={filterTypeMenuVisible} onDismiss={() => setFilterTypeMenuVisible(false)}
              anchor={<Button mode="outlined" icon="chevron-down" onPress={() => setFilterTypeMenuVisible(true)}
                style={styles.fieldButton}>
                {busTypeFilter || 'All bus types'}
              </Button>}>
              <Menu.Item title="All bus types" onPress={() => { setBusTypeFilter(''); setFilterTypeMenuVisible(false); }} />
              {BUS_TYPES.map((type) => (
                <Menu.Item key={type} title={type}
                  onPress={() => { setBusTypeFilter(type); setFilterTypeMenuVisible(false); }} />
              ))}
            </Menu>
            <View style={styles.statusFilters}>
              {['', 'ACTIVE', 'INACTIVE'].map((status) => (
                <Button key={status || 'ALL'} mode={statusFilter === status ? 'contained' : 'outlined'}
                  onPress={() => setStatusFilter(status)} compact>
                  {status || 'All'}
                </Button>
              ))}
            </View>
          </Card.Content>
        </Card>

        <View style={styles.listHeader}>
          <Text variant="titleLarge" style={styles.listTitle}>Bus records</Text>
          <Button
            mode="contained"
            icon="plus"
            onPress={openAddForm}
            disabled={loading || saving}
          >
            Add new bus
          </Button>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#6750A4" style={styles.loader} />
        ) : filteredBuses.length === 0 ? (
          <Card style={styles.emptyCard}><Card.Content><Text>No buses match the current filters.</Text></Card.Content></Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text variant="labelMedium" style={[styles.tableCell, styles.imageColumn]}>Image</Text>
                <Text variant="labelMedium" style={[styles.tableCell, styles.busNumberColumn]}>Bus number</Text>
                <Text variant="labelMedium" style={[styles.tableCell, styles.operatorColumn]}>Operator</Text>
                <Text variant="labelMedium" style={[styles.tableCell, styles.typeColumn]}>Bus type</Text>
                <Text variant="labelMedium" style={[styles.tableCell, styles.numberColumn]}>Capacity</Text>
                <Text variant="labelMedium" style={[styles.tableCell, styles.numberColumn]}>Seat rows</Text>
                <Text variant="labelMedium" style={[styles.tableCell, styles.numberColumn]}>Seats left</Text>
                <Text variant="labelMedium" style={[styles.tableCell, styles.numberColumn]}>Seats right</Text>
                <Text variant="labelMedium" style={[styles.tableCell, styles.statusColumn]}>Status</Text>
                <Text variant="labelMedium" style={[styles.tableCell, styles.actionsColumn]}>Actions</Text>
              </View>
              {filteredBuses.map((bus) => (
                <View key={bus.busId} style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.imageColumn]}>
                    {bus.busImageUrl ? (
                      <Image source={{ uri: bus.busImageUrl }} style={styles.tableImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.tableImagePlaceholder}><Text variant="labelSmall">No image</Text></View>
                    )}
                  </View>
                  <Text variant="bodySmall" style={[styles.tableCell, styles.busNumberColumn, styles.tableText]}>{bus.busNumber}</Text>
                  <Text variant="bodySmall" style={[styles.tableCell, styles.operatorColumn, styles.tableText]}>{bus.operatorName}</Text>
                  <Text variant="bodySmall" style={[styles.tableCell, styles.typeColumn, styles.tableText]}>{bus.busType}</Text>
                  <Text variant="bodySmall" style={[styles.tableCell, styles.numberColumn, styles.tableText]}>{bus.totalCapacity}</Text>
                  <Text variant="bodySmall" style={[styles.tableCell, styles.numberColumn, styles.tableText]}>{bus.seatRowCount || 0}</Text>
                  <Text variant="bodySmall" style={[styles.tableCell, styles.numberColumn, styles.tableText]}>{bus.seatsPerRowLeft}</Text>
                  <Text variant="bodySmall" style={[styles.tableCell, styles.numberColumn, styles.tableText]}>{bus.seatsPerRowRight}</Text>
                  <View style={[styles.tableCell, styles.statusColumn]}>
                    <Text variant="labelSmall" style={[styles.status, bus.isActive ? styles.active : styles.inactive]}>
                      {bus.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                  <View style={[styles.tableCell, styles.actionsColumn]}>
                    <Button mode="outlined" compact icon="pencil-outline" onPress={() => editBus(bus)}>Edit</Button>
                    <Button
                      mode="text"
                      compact
                      onPress={() => toggleActive(bus)}
                      loading={saving && editingId === null}
                      textColor={bus.isActive ? '#B3261E' : '#166534'}
                    >
                      {bus.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F8' },
  content: { padding: 18, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerActionPlaceholder: { width: 48, height: 48 },
  heading: { flex: 1 },
  eyebrow: { color: '#6750A4', letterSpacing: 1 },
  title: { color: '#1D1B20', fontWeight: '700' },
  formCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginBottom: 14 },
  filterCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginBottom: 14 },
  sectionTitle: { color: '#1D1B20', fontWeight: '700', marginBottom: 10 },
  fieldButton: { marginBottom: 10 },
  input: { backgroundColor: '#FFFBFE', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  radioRow: { flexDirection: 'row', alignItems: 'center' },
  radioOption: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  imagePreviewSection: { marginBottom: 10 },
  imagePreviewLabel: { color: '#625B71', marginBottom: 6 },
  preview: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#E7E0EC' },
  imagePlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#E7E0EC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  imagePlaceholderText: { color: '#625B71', textAlign: 'center' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  statusFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  listTitle: { color: '#1D1B20', fontWeight: '700', marginVertical: 12 },
  loader: { marginVertical: 30 },
  emptyCard: { backgroundColor: '#FFFBFE', borderRadius: 16 },
  table: { backgroundColor: '#FFFBFE', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E7E0EC' },
  tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E7E0EC' },
  tableHeader: { backgroundColor: '#F3F4F8', borderBottomWidth: 2 },
  tableCell: { paddingHorizontal: 8, paddingVertical: 10, justifyContent: 'center' },
  tableText: { color: '#49454F' },
  imageColumn: { width: 90 },
  busNumberColumn: { width: 130 },
  operatorColumn: { width: 150 },
  typeColumn: { width: 130 },
  numberColumn: { width: 90, alignItems: 'center' },
  statusColumn: { width: 100, alignItems: 'center' },
  actionsColumn: { width: 190, alignItems: 'center', gap: 4 },
  tableImage: { width: 64, height: 48, borderRadius: 6, backgroundColor: '#E7E0EC' },
  tableImagePlaceholder: { width: 64, height: 48, borderRadius: 6, backgroundColor: '#F3F4F8', alignItems: 'center', justifyContent: 'center' },
  detail: { color: '#625B71', marginTop: 5 },
  status: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden' },
  active: { backgroundColor: '#DCFCE7', color: '#166534' },
  inactive: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  busActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  errorCard: { backgroundColor: '#FCE8E6', marginBottom: 12 },
  errorText: { color: '#B3261E' },
  messageCard: { backgroundColor: '#DDF7E3', marginBottom: 12 },
  messageText: { color: '#166534' },
});
