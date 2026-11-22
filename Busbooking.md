Online Bus Booking Service - Dynamic Seat Selection Specification
This document details the functional specifications, dynamic seat arrangement architecture, UI/UX design patterns, and navigation flow for the Online Bus Booking Service page.


1. System Overview & Page Alignment
To maintain design consistency across the entire bus booking portal, this page follows standard UI tokens:


•	Design System: Modern, responsive card-based layout with standard brand colors.

•	Header / Footer Alignment: Matches top navigation bar and global footer.

•	Typography & Icons: Standardized font family and SVG icon set for seat states and driver positions.

2. Dynamic Seat Arrangement System
The seating arrangement is fully dynamic and generated based on configuration inputs (e.g., bus model data or user parameter overrides).


Structural Rules:
1.	Two Main Column Sets: The aisle splits the bus width into a Left Column Set and a Right Column Set.

2.	Variable Seats Per Row:


o	Each side (Left/Right) can contain 2 or 3 seats per row (e.g., 2+2, 2+3, 3+2, 3+3 layouts).

3.	Dynamic Rows:


o	Total number of rows is rendered dynamically based on inputs ($N$ rows, typically between 5 and 15).

o	Seat numbers are auto-generated using row indices and column letters (e.g., 1A, 1B, 1C, 1D).

3. Seat Statuses & Color Combination Matrix
Each seat icon displays its status clearly using distinct background colors, border styles, and contextual badges/icons:

Status Code
	Status Name
	Color Coding & Visual Indicator
	Description

AVAIL
	Available
	Green Border / Light Green Fill (#10b981)
	Open for selection by any passenger.

BOOKED
	Already Booked
	Neutral Gray (#9ca3af)
	Occupied; unselectable.

F_AVAIL
	Available only for Female
	Pink Border / Light Pink Fill (#ec4899 + $\mathrm{\female}$)
	Reserved exclusively for female travelers.

F_BOOKED
	Booked for Female Passenger
	Dark Magenta / Deep Pink (#be185d + $\mathrm{\female}$)
	Booked by a female traveler; unselectable.

M_AVAIL
	Available for Male Passenger
	Blue Border / Light Blue Fill (#3b82f6 + $\mathrm{\male}$)
	Reserved exclusively for male travelers.

M_BOOKED
	Booked by Male Passenger
	Dark Blue / Navy (#1d4ed8 + $\mathrm{\male}$)
	Booked by a male traveler; unselectable.

SELECTED
	Currently Selected
	Amber / Gold Highlight (#f59e0b + $\checkmark$)
	Active selection by current customer.

4. Driver Position & Vehicle Layout
•	Location: Top front corner of the seating layout grid (Right or Left side depending on regional standard).

•	Marker: Displayed with a distinct steering wheel icon/logo badge and labeled clearly as "Driver Position".

•	Visual Separation: Separated from passenger seats by a clear partition bar.

5. End-to-End Navigation & Redirection Workflow
[ Step 1: Bus Route List Page ]
        |
        |---> User clicks "Select Bus"
        v
[ Step 2: Dynamic Seat Selection Page ]
        |
        |---> User configures seats / selects active seats
        |---> Clicks "Proceed to Booking Summary"
        v
[ Step 3: My Booking Summary Page ]

Flow Breakdown:
1.	Redirection Trigger (Inbound):


o	Clicking "Select Bus" on any bus card in the search listing redirects the user to the Seat Booking Service Page with bus meta parameters (Bus ID, Type, Seat Matrix Configuration, Base Fare).

2.	Interactive Selection:


o	Customer picks desired seat(s) matching their gender criteria.

o	Live pricing calculation displays total fare, taxes, and selected seat numbers.

3.	Redirection Trigger (Outbound):


o	Clicking "Proceed to Summary" validates selection rules and redirects the user to "My Booking Summary Page" passing selected seat IDs and passenger details.

6. Layout Configuration Examples
Example A: Standard 2 + 2 Layout (4 Seats/Row)
  [ FRONT ]                 [ DRIVER LOGO ]
--------------------------------------------
 [Row 1]   (1A) (1B)  |AISLE|  (1C) (1D)
 [Row 2]   (2A) (2B)  |AISLE|  (2C) (2D)
 ...

Example B: Deluxe 2 + 3 Layout (5 Seats/Row)
  [ FRONT ]                 [ DRIVER LOGO ]
--------------------------------------------
 [Row 1]   (1A) (1B)       |AISLE|  (1C) (1D) (1E)
 [Row 2]   (2A) (2B)       |AISLE|  (2C) (2D) (2E)
