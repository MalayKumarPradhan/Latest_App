Here is a comprehensive standard instruction and implementation guide for building the **Bus Search, Filtering, and Listing** feature in your React Native app, powered by your Node.js backend.

---

## 📋 Architectural Overview

1. **Frontend (React Native & React Native Paper):** Allows users to select Start and Destination locations, apply filters (AC/Non-AC, Sleeper/Seater, Price range, Departure time), and displays the available buses dynamically.
2. **Backend (Node.js & Express / Database):** Exposes a secure API endpoint (`/api/buses/search`) that queries the database with dynamic filter parameters and returns real-time bus availability.

---

## Part 1: Node.js Backend API Implementation

### 1. Database Schema & Query Logic (`busController.js`)

Assuming you are using MongoDB/Mongoose or a relational database, your API needs to handle query parameters for origin, destination, bus type, and pricing.

```javascript
// controllers/busController.js
const Bus = require('../models/Bus'); // Adjust based on your ORM/ODM

exports.searchBuses = async (req, res) => {
  try {
    const { origin, destination, type, minPrice, maxPrice, sortBy } = req.query;

    // Build dynamic query filter
    let query = {};
    if (origin) query.origin = new RegExp(origin, 'i');
    if (destination) query.destination = new RegExp(destination, 'i');
    if (type) query.busType = type; // e.g., 'AC Sleeper', 'Non-AC Seater'
    
    if (minPrice || maxPrice) {
      query.fare = {};
      if (minPrice) query.fare.$gte = Number(minPrice);
      if (maxPrice) query.fare.$lte = Number(maxPrice);
    }

    // Build sorting logic
    let sortOption = {};
    if (sortBy === 'price_low') sortOption.fare = 1;
    if (sortBy === 'price_high') sortOption.fare = -1;
    if (sortBy === 'departure') sortOption.departureTime = 1;

    const buses = await Bus.find(query).sort(sortOption);

    res.status(200).json({
      success: true,
      count: buses.length,
      data: buses,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

```

### 2. API Routes (`busRoutes.js`)

```javascript
// routes/busRoutes.js
const express = require('express');
const router = express.Router();
const { searchBuses } = require('../controllers/busController');

router.get('/search', searchBuses);

export default router;

```

---

## Part 2: React Native Frontend Implementation

### 1. API Service Layer (`busService.js`)

```javascript
// services/busService.js
import axios from 'axios';

const API_BASE_URL = 'https://your-node-backend-url.com/api'; // Replace with your backend URL

export const fetchAvailableBuses = async (filters = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/buses/search`, {
      params: filters,
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching buses:', error);
    throw error;
  }
};

```

### 2. Search, Filter, and Listing Component (`BusSearchScreen.jsx`)

This component utilizes **React Native Paper** for UI components and integrates the search inputs, filter options, and data population.

```javascript
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Scrollable } from 'react-native';
import { TextInput, Button, Card, Title, Paragraph, Chip, ActivityIndicator, Text } from 'react-native-paper';
import { fetchAvailableBuses } from '../services/busService';

const BusSearchScreen = () => {
  // Search State
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  
  // Filter States
  const [selectedType, setSelectedType] = useState(null); // 'AC', 'Non-AC', 'Sleeper'
  const [sortBy, setSortBy] = useState(null); // 'price_low', 'departure'
  
  // Data State
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch buses function
  const handleSearch = async () => {
    setLoading(true);
    try {
      const filters = {
        origin,
        destination,
        type: selectedType,
        sortBy,
      };
      const data = await fetchAvailableBuses(filters);
      setBuses(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    handleSearch();
  }, []);

  const renderBusItem = ({ item }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Title>{item.busName}</Title>
        <Paragraph>Route: {item.origin} ➔ {item.destination}</Paragraph>
        <Paragraph>Type: {item.busType} | Seats Left: {item.availableSeats}</Paragraph>
        <Paragraph style={styles.fare}>Fare: ₹{item.fare}</Paragraph>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Search Inputs */}
      <View style={styles.searchContainer}>
        <TextInput
          label="From (Start)"
          value={origin}
          onChangeText={setOrigin}
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label="To (Destination)"
          value={destination}
          onChangeText={setDestination}
          style={styles.input}
          mode="outlined"
        />
        <Button mode="contained" onPress={handleSearch} style={styles.searchButton}>
          Search Buses
        </Button>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filters:</Text>
        <View style={styles.chipRow}>
          <Chip
            selected={selectedType === 'AC'}
            onPress={() => setSelectedType(selectedType === 'AC' ? null : 'AC')}
            style={styles.chip}
          >
            AC
          </Chip>
          <Chip
            selected={selectedType === 'Sleeper'}
            onPress={() => setSelectedType(selectedType === 'Sleeper' ? null : 'Sleeper')}
            style={styles.chip}
          >
            Sleeper
          </Chip>
          <Chip
            selected={sortBy === 'price_low'}
            onPress={() => setSortBy(sortBy === 'price_low' ? null : 'price_low')}
            style={styles.chip}
          >
            Cheapest
          </Chip>
        </View>
      </View>

      {/* Bus List */}
      {loading ? (
        <ActivityIndicator animating={true} size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={buses}
          keyExtractor={(item) => item._id || item.id}
          renderItem={renderBusItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No buses found matching your criteria.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  searchContainer: { marginBottom: 12 },
  input: { marginBottom: 8, backgroundColor: '#fff' },
  searchButton: { marginTop: 4 },
  filterContainer: { marginBottom: 12 },
  filterLabel: { fontWeight: 'bold', marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { marginRight: 8, marginBottom: 8 },
  card: { marginBottom: 12, backgroundColor: '#fff' },
  fare: { fontWeight: 'bold', color: '#2e7d32', marginTop: 4 },
  loader: { marginTop: 40 },
  emptyText: { textAlign: 'center', color: '#777', marginTop: 40 },
});

export default BusSearchScreen;

```

---

## Part 3: Implementation Checklist & Integration Notes

1. **Database Schema Fields Required:** Ensure your database documents include:
* `busName` (String)
* `origin` (String)
* `destination` (String)
* `busType` (String - e.g., 'AC', 'Non-AC', 'Sleeper')
* `fare` (Number)
* `availableSeats` (Number)
* `departureTime` (String/Date)


2. **State Management Hook:** If your existing project uses Redux or Context API for state management, you can map `fetchAvailableBuses` into your existing thunks/reducers.
3. **Icons & Styling:** Feel free to swap `react-native-paper` component themes or integrate `react-native-vector-icons` for transport icons to match your project's design system.

---

Would you like me to tailor the database model or Redux integration to match existing files from your workspace?