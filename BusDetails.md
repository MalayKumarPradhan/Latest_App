Please refine and update the online bus booking service seat selection page (`bus_booking_service.md` and UI design) by adding the following features and sections:

---

### **1. Navigation Toggle / Screen Switcher (Bottom Bar)**
- Add a persistent bottom navigation bar on the Seat Booking Page to allow users to switch smoothly between two main screens/views:
  - **Screen 1: Seat Selection View** (Dynamic seat grid layout, status key, driver position, and price summary)
  - **Screen 2: Bus & Trip Details View** (About Bus, Route details, Boarding/Dropping points, and Ratings/Reviews)

---

### **2. About Bus Section**
- **Bus Images**: Include an interactive image gallery/carousel featuring 2–3 high-quality images of the bus (Exterior view, Interior layout, and Premium seating).
- **Bus Details**: 
  - Bus Registration/Vehicle Number (e.g., `WB 30 A 4589`)
  - Bus Type & Model (e.g., *Volvo 9600 Multi-Axle AC Sleeper / Seater (2+2)*)
  - Short Description detailing amenities (e.g., Air Conditioning, Charging Ports, Reclining Seats, Reading Lights, Free Wi-Fi, Water Bottle).

---

### **3. Bus Route Section**
- Display a predefined route timeline showing:
  - **Origin City / Terminal**
  - **Intermediate Stops & Halt Timings**
  - **Final Destination Terminal**
- Visual representation using a step-by-step vertical or horizontal route line with stop indicators.

---

### **4. Boarding Points Section**
- Interactive selection for the customer’s **Source Location / Pickup Point**.
- Each boarding point should display:
  - Pickup Location Name (e.g., *Sutahata Bus Stand / Haldia Crossing*)
  - Exact Departure Time
  - Address / Landmark details

---

### **5. Dropping Points Section**
- Interactive selection for the customer’s **Destination Stop / Drop-off Point**.
- Each dropping point should display:
  - Drop Location Name (e.g., *Esplanade / Karunamoyee Bus Terminus*)
  - Estimated Arrival Time
  - Landmark / Terminal details

---

### **6. Ratings & Reviews Section**
- Display aggregate star rating (e.g., `4.5 ★ out of 5`) based on verified passenger feedback.
- Detailed rating breakdown across parameters:
  - **Punctuality**: 4.6/5
  - **Bus Cleanliness**: 4.4/5
  - **Staff Behavior**: 4.5/5
- User Review Cards showing real passenger feedback, reviewer name, date of travel, and verified booking badge.

---

### **Workflow Integration**
- Keep the design aligned with the existing dynamic seat selection pattern, gender-based status indicators, and driver position badge.
- Ensure seamless screen switching between **Seat Selection** and **Bus Details** before proceeding to **My Booking Summary**.