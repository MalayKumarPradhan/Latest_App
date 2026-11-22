Here is a comprehensive draft of the improved feature instructions and requirements to upgrade your existing bus booking system.

---

# Feature Enhancement Specification: Source/Destination Geolocation, Location Management, & Live Bus Tracking Engine

## 1. Overview

Upgrade the existing Bus Booking System by adding detailed geolocation metadata (Latitude, Longitude, District, and Postal Code/PIN Code) for all Source and Destination bus stops/terminals. Integrate location search APIs, searchable select controls with dynamic filtering, and a System Admin Panel for managing locations. Calculate real-time estimated arrival times (ETA) and passenger wait times for live bus tracking.

---

## 2. Updated Data Schema & API Models

### 2.1 Database Schema Additions (Location Entity)

Add or update the `Locations` table/collection with the following attributes:

* `location_id` (Primary Key, UUID/Auto-increment)
* `location_name` (String, Required) - e.g., "Kolkata Central Bus Terminal"
* `short_code` (String, Optional) - e.g., "KCT-01"
* `latitude` (Decimal/Float, Required) - e.g., `22.572645`
* `longitude` (Decimal/Float, Required) - e.g., `88.363892`
* `district` (String, Required) - e.g., "Kolkata"
* `state` (String, Required) - e.g., "West Bengal"
* `pincode` / `zip_code` (String/Integer, Required) - e.g., `"700001"`
* `status` (Enum: `ACTIVE`, `INACTIVE`)
* `created_at` & `updated_at` (Timestamps)

---

## 3. API Requirements

### 3.1 Public & Booking APIs

1. **GET `/api/v1/locations/search**`
* **Query Parameters:** `q` (search string), `district`, `pincode`, `limit`, `status=ACTIVE`
* **Response:** List of locations including name, district, PIN code, latitude, and longitude.


2. **GET `/api/v1/tracking/eta**`
* **Query Parameters:** `bus_id`, `current_lat`, `current_lng`, `destination_location_id`
* **Response:**
* `distance_km`: Calculated distance between live bus location and target location.
* `estimated_time_arrival_mins`: Estimated time to reach target.
* `passenger_wait_time_mins`: Estimated waiting time for passenger at source/pickup location.
* `traffic_delay_mins`: Real-time traffic delay factor.





### 3.2 Admin Panel APIs (System Admin Role Only)

1. **POST `/api/v1/admin/locations**` — Add a new source or destination location.
2. **PUT `/api/v1/admin/locations/{id}**` — Update an existing location (coordinates, district, PIN code, status).
3. **DELETE `/api/v1/admin/locations/{id}**` — Soft-delete or deactivate a location.
4. **GET `/api/v1/admin/locations**` — Paginated list of all locations with advanced administrative filtering.

---

## 4. UI/UX & Frontend Components

### 4.1 Enhanced Location Select Controls (User & Booking Portal)

* **Searchable & Filterable Dropdowns:**
* Replace standard select menus with searchable components (e.g., Select2, React-Select, or custom autocomplete controls).
* **Search By:** Location Name, District, or PIN Code.
* **Display Format:** `[Location Name], [District] - [PIN Code]` (e.g., *Esplanade Bus Stop, Kolkata - 700069*).


* **Recent & Popular Suggestions:** Show top/frequently selected source and destination hubs when clicking the field.

### 4.2 System Admin Panel (Location Management Dashboard)

* **CRUD Interface:** Form to add and edit Source and Destination locations with inputs for:
* Location Name
* District
* PIN Code / Postal Code
* Latitude & Longitude (Manual entry + interactive map picker pin drop using Leaflet / Google Maps).


* **Location Lookup Integration:** Autocomplete button (e.g., using Google Places or OpenStreetMap Geocoding API) to auto-fill District, PIN code, Latitude, and Longitude based on address entry.
* **Status Management:** Toggle locations between Active and Inactive.

---

## 5. Live Bus Tracking & ETA Calculation Logic

### 5.1 Distance & Duration Calculation

1. **Haversine Formula (Fallback/Offline mode):**
* Calculate direct distance between current bus GPS coordinates `(bus_lat, bus_lng)` and passenger destination/pickup coordinates `(dest_lat, dest_lng)`.


2. **Routing API Integration (Primary Mode):**
* Integrate OSRM (Open Source Routing Machine), Google Distance Matrix API, or Mapbox Directions API for actual road network distance and live traffic conditions.



### 5.2 ETA & Customer Waiting Time Metrics

* **Customer Wait Time:** Calculated as the estimated travel time from the bus's live GPS position to the user's selected **Source/Pickup Location**.
* **Trip ETA:** Calculated as the estimated travel time from the bus's live GPS position to the final **Destination Location**.
* **Formula:**
$$\text{ETA (mins)} = \frac{\text{Distance to Target (km)}}{\text{Average Speed (km/h)}} \times 60 + \text{Traffic Delay Buffer (mins)}$$



---

## 6. System Architecture & Operational Workflow

```
[System Admin Panel] ─── (Add/Update Location) ───► [Database (Locations Table)]
                                                              │
                                                              ▼
[Passenger Booking App] ─── (Search Source/Destination) ◄─────┘
         │
         ├───► [Live GPS Tracker] (Bus Coordinates)
         │           │
         │           ▼
         └───► [ETA Calculation Engine] ───► Displays Customer Wait Time & Destination ETA

```

