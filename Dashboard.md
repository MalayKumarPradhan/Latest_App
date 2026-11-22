# Operations Dashboard

The operations dashboard is implemented as a React Native screen using the
project's React Navigation, React Native Paper, and existing API services. The
HTML sample is a visual reference; its mock personas, sample numbers, Tailwind,
Chart.js, and CDN assets are not used in the app.

## Access

The **Operations dashboard** drawer item is shown to:

- `Conductor`
- `OperatorAdmin`
- `SystemAdmin`

Passenger accounts do not see this screen. Backend authorization remains
authoritative; hiding a navigation item is not a security boundary.

## Available dashboard data

The dashboard uses real application API responses and refreshes when opened,
when manually refreshed, and every 30 seconds while visible.

Filters support operation date, service (operator and route), and bus number.
Date selection is applied to the schedule search; service and bus selections
scope the displayed records.

### Conductor

Shows scheduled public services, distinct buses, and remaining seats for the
selected date. The API currently has no conductor-to-trip assignment, ticket
sale, payment, or shift data. As a result, these listings are explicitly not
presented as assigned trips or personal sales/collection figures.

### OperatorAdmin

Shows reservation and confirmed-booking summaries from the operator-scoped
`GET /admin/reservations` endpoint. Trip and bus counts are derived from
reservations for the selected departure date, so they represent trips/buses
with reservations, not the full operator fleet.

### SystemAdmin

Shows platform-wide schedules, reservations, confirmed booking value, and
registered-user count. Booking value is calculated from confirmed reservation
amounts; it is not a payment settlement, cash/digital split, or audited revenue
total.

## Current API dependencies

- `GET /buses/search?date=YYYY-MM-DD` — scheduled services and seat availability
- `GET /admin/reservations` — reservation history, scoped by the API to the
  operator owner or the system administrator
- `GET /admin/users` — user count for system administrators

The dashboard treats the bus-search endpoint's `404` response for an empty
date as an empty schedule list. Other API failures are shown as errors rather
than replaced with sample data.

## Not yet supported by the backend

The sample dashboard also describes cash/digital collections, ticket-sales
trends, conductor assignments, crew allocations, maintenance/fuel state,
punctuality, audit logs, and historical revenue comparisons. Those fields or
analytics are not available from the current API/database model, so they are
not invented or shown as live metrics. Add the corresponding data model and
authorized API endpoints before exposing those reports.
