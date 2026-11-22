import axios from 'axios';

import { API_BASE_URL } from '../config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

let currentToken = null;
let currentRefreshToken = null;
let refreshPromise = null;
let tokenUpdateHandler = null;

export function setAuthTokens(tokens) {
  currentToken = tokens?.token || null;
  currentRefreshToken = tokens?.refreshToken || null;
}

export function setTokenUpdateHandler(handler) {
  tokenUpdateHandler = handler;
}

api.interceptors.request.use((config) => {
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const isAuthRequest = request?.url?.startsWith('/auth/');
    if (error.response?.status !== 401 || !request || request._retry || !currentRefreshToken || isAuthRequest) {
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = api.post('/auth/refresh', { refreshToken: currentRefreshToken })
          .then(async ({ data }) => {
            if (!data?.token || !data?.refreshToken) {
              throw new Error('The authentication service returned an incomplete token response.');
            }
            setAuthTokens(data);
            if (tokenUpdateHandler) await tokenUpdateHandler(data);
            return data;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const tokens = await refreshPromise;
      request.headers.Authorization = `Bearer ${tokens.token}`;
      return api.request(request);
    } catch (refreshError) {
      setAuthTokens(null);
      if (tokenUpdateHandler) await tokenUpdateHandler(null);
      return Promise.reject(refreshError);
    }
  }
);

export async function loginApi({ identifier, email, password }) {
  return api.post('/auth/login', { identifier: identifier || email, password });
}

export async function signupApi({ name, identifier, email, password, termsAccepted }) {
  return api.post('/auth/signup', { name, identifier: identifier || email, password, termsAccepted });
}

export async function requestPasswordResetApi(identifier) {
  return api.post('/auth/forgot-password', { identifier });
}

export async function logoutApi(refreshToken) {
  return api.post('/auth/logout', { refreshToken });
}

export async function verifyRecoveryCodeApi(identifier, code) {
  return api.post('/auth/verify-recovery-code', { identifier, code });
}

export async function resetPasswordApi(identifier, code, password) {
  return api.post('/auth/reset-password', { identifier, code, password });
}

export async function fetchBusOptions(filters = {}) {
  const response = await api.get('/buses/search', { params: filters });
  if (!Array.isArray(response.data)) {
    throw new Error('The bus search service returned an invalid response.');
  }
  return response.data;
}

export async function fetchBusLocations() {
  const response = await api.get('/locations');
  if (!Array.isArray(response.data) || response.data.some((location) =>
    !Number.isSafeInteger(Number(location.locationId)) ||
    typeof location.locationName !== 'string' ||
    typeof location.cityName !== 'string' ||
    typeof location.district !== 'string' ||
    typeof location.state !== 'string' ||
    typeof location.pincode !== 'string' ||
    !Number.isFinite(Number(location.latitude)) ||
    !Number.isFinite(Number(location.longitude))
  )) {
    throw new Error('The locations service returned an invalid response.');
  }
  return response.data;
}

export async function searchLocationsApi(filters = {}) {
  const response = await api.get('/locations/search', { params: filters });
  if (!Array.isArray(response.data) || response.data.some((location) =>
    !Number.isSafeInteger(Number(location.locationId)) ||
    typeof location.locationName !== 'string' ||
    typeof location.cityName !== 'string' ||
    typeof location.district !== 'string' ||
    typeof location.state !== 'string' ||
    typeof location.pincode !== 'string' ||
    !Number.isFinite(Number(location.latitude)) ||
    !Number.isFinite(Number(location.longitude))
  )) {
    throw new Error('The location search service returned an invalid response.');
  }
  return response.data;
}

export async function fetchManagedLocations(filters = {}) {
  const response = await api.get('/admin/locations', { params: filters });
  if (!Array.isArray(response.data?.items) ||
    !Number.isSafeInteger(Number(response.data?.total)) ||
    !Number.isSafeInteger(Number(response.data?.page))) {
    throw new Error('The location management service returned an invalid response.');
  }
  return response.data;
}

export async function fetchManagedLocationCities() {
  const response = await api.get('/admin/locations/cities');
  if (!Array.isArray(response.data) || response.data.some((city) =>
    !Number.isSafeInteger(Number(city.cityId)) || typeof city.cityName !== 'string'
  )) {
    throw new Error('The route city service returned an invalid response.');
  }
  return response.data;
}

export async function fetchLocationStates() {
  const response = await api.get('/geo/states');
  if (!Array.isArray(response.data) || response.data.some((state) => typeof state !== 'string')) {
    throw new Error('The state directory returned an invalid response.');
  }
  return response.data;
}

export async function fetchLocationDistricts(state) {
  const response = await api.get('/geo/districts', { params: { state } });
  if (!Array.isArray(response.data) || response.data.some((district) => typeof district !== 'string')) {
    throw new Error('The district directory returned an invalid response.');
  }
  return response.data;
}

export async function geocodeLocationApi(address) {
  const response = await api.get('/geo/geocode', { params: { address } });
  if (!Number.isFinite(Number(response.data?.latitude)) ||
    !Number.isFinite(Number(response.data?.longitude)) ||
    typeof response.data?.state !== 'string') {
    throw new Error('The geocoding service returned an invalid response.');
  }
  return response.data;
}

export async function createManagedLocation(payload) {
  return api.post('/admin/locations', payload);
}

export async function updateManagedLocation(locationId, payload) {
  if (!Number.isSafeInteger(Number(locationId)) || Number(locationId) <= 0) {
    throw new Error('A valid location is required.');
  }
  return api.put(`/admin/locations/${locationId}`, payload);
}

export async function deactivateManagedLocation(locationId) {
  if (!Number.isSafeInteger(Number(locationId)) || Number(locationId) <= 0) {
    throw new Error('A valid location is required.');
  }
  return api.delete(`/admin/locations/${locationId}`);
}

export async function fetchManagedRoutes() {
  const response = await api.get('/admin/routes');
  if (!Array.isArray(response.data) || response.data.some((route) =>
    !Number.isSafeInteger(Number(route.routeId)) ||
    typeof route.routeCode !== 'string' ||
    typeof route.routeName !== 'string'
  )) {
    throw new Error('The route management service returned an invalid response.');
  }
  return response.data;
}

export async function createManagedRoute(payload) {
  return api.post('/admin/routes', payload);
}

export async function fetchManagedRouteWaypoints(routeId) {
  if (!Number.isSafeInteger(Number(routeId)) || Number(routeId) <= 0) {
    throw new Error('A valid route is required.');
  }
  const response = await api.get(`/admin/routes/${routeId}/waypoints`);
  if (!Array.isArray(response.data?.waypoints) ||
    !Number.isSafeInteger(Number(response.data?.routeId))) {
    throw new Error('The route waypoint service returned an invalid response.');
  }
  return response.data;
}

export async function addManagedRouteWaypoint(routeId, payload) {
  return api.post(`/admin/routes/${routeId}/waypoints`, payload);
}

export async function updateManagedRouteWaypoint(routeId, stopId, payload) {
  return api.put(`/admin/routes/${routeId}/waypoints/${stopId}`, payload);
}

export async function deleteManagedRouteWaypoint(routeId, stopId) {
  return api.delete(`/admin/routes/${routeId}/waypoints/${stopId}`);
}

export async function reorderManagedRouteWaypoints(routeId, stopIds) {
  return api.put(`/admin/routes/${routeId}/reorder`, { stopIds });
}

export async function submitManagedRouteChanges(routeId) {
  if (!Number.isSafeInteger(Number(routeId)) || Number(routeId) <= 0) {
    throw new Error('A valid route is required.');
  }
  return api.post(`/admin/routes/${routeId}/submit`);
}

export async function fetchManagedBuses() {
  const response = await api.get('/admin/buses');
  if (!Array.isArray(response.data?.items) || !Array.isArray(response.data?.operators)) {
    throw new Error('The bus management service returned an invalid response.');
  }
  return response.data;
}

export async function fetchManagedOperators() {
  const response = await api.get('/admin/operators');
  if (!Array.isArray(response.data) || response.data.some((operator) =>
    !Number.isSafeInteger(Number(operator.operatorId)) ||
    typeof operator.operatorName !== 'string'
  )) {
    throw new Error('The operator service returned an invalid response.');
  }
  return response.data;
}

export async function createManagedBus(payload) {
  return api.post('/admin/buses', payload);
}

export async function updateManagedBus(busId, payload) {
  if (!Number.isSafeInteger(Number(busId)) || Number(busId) <= 0) {
    throw new Error('A valid bus is required.');
  }
  return api.put(`/admin/buses/${busId}`, payload);
}

export async function uploadManagedBusImage(busId, uri) {
  if (!Number.isSafeInteger(Number(busId)) || Number(busId) <= 0) {
    throw new Error('A valid bus is required.');
  }
  const formData = new FormData();
  if (typeof document !== 'undefined' && uri.startsWith('blob:')) {
    const blob = await fetch(uri).then((response) => response.blob());
    formData.append('image', blob, 'bus-image');
  } else {
    formData.append('image', {
      uri,
      type: 'image/jpeg',
      name: 'bus-image.jpg',
    });
  }
  const response = await api.post(`/admin/buses/${busId}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function fetchManagedSchedules() {
  const response = await api.get('/admin/schedules');
  if (!Array.isArray(response.data?.schedules) ||
    !Array.isArray(response.data?.routes) ||
    !Array.isArray(response.data?.buses)) {
    throw new Error('The schedule management service returned an invalid response.');
  }
  return response.data;
}

export async function createManagedSchedule(payload) {
  return api.post('/admin/schedules', payload);
}

export async function updateManagedSchedule(scheduleId, payload) {
  if (!Number.isSafeInteger(Number(scheduleId)) || Number(scheduleId) <= 0) {
    throw new Error('A valid schedule is required.');
  }
  return api.put(`/admin/schedules/${scheduleId}`, payload);
}

export async function cancelManagedSchedule(scheduleId) {
  if (!Number.isSafeInteger(Number(scheduleId)) || Number(scheduleId) <= 0) {
    throw new Error('A valid schedule is required.');
  }
  return api.post(`/admin/schedules/${scheduleId}/cancel`);
}

export async function fetchTrackingEta(params) {
  const response = await api.get('/tracking/eta', { params });
  if (!Number.isFinite(Number(response.data?.distance_km)) ||
    !Number.isFinite(Number(response.data?.estimated_time_arrival_mins)) ||
    !Number.isFinite(Number(response.data?.traffic_delay_mins))) {
    throw new Error('The tracking service returned an invalid ETA response.');
  }
  return response.data;
}

export async function fetchScheduleSeats(scheduleId, layout = {}) {
  if (!Number.isSafeInteger(Number(scheduleId)) || Number(scheduleId) <= 0) {
    throw new Error('A valid schedule is required to load its seats.');
  }
  const response = await api.get(`/schedules/${scheduleId}/seats`, { params: layout });
  if (!Array.isArray(response.data?.rows) || !Number.isFinite(Number(response.data?.price))) {
    throw new Error('The seat service returned an invalid response.');
  }
  return response.data;
}

export async function fetchScheduleDetails(scheduleId) {
  if (!Number.isSafeInteger(Number(scheduleId)) || Number(scheduleId) <= 0) {
    throw new Error('A valid schedule is required to load trip details.');
  }
  const response = await api.get(`/schedules/${scheduleId}/details`);
  const details = response.data;
  if (!details?.bus || !details?.route || !Array.isArray(details.route.stops) ||
    !details?.rating || !Array.isArray(details.reviews)) {
    throw new Error('The trip details service returned an invalid response.');
  }
  return details;
}

export async function createBookingApi(payload) {
  const response = await api.post('/bookings', payload);
  if (response.status !== 201 || !response.data?.pnr || response.data?.status !== 'confirmed') {
    throw new Error('The booking service did not confirm the reservation.');
  }
  return response;
}

export async function fetchManagedReservations() {
  const response = await api.get('/admin/reservations');
  if (!Array.isArray(response.data)) {
    throw new Error('The reservation management service returned an invalid response.');
  }
  return response.data;
}

export async function cancelManagedReservation(bookingId) {
  if (!Number.isSafeInteger(Number(bookingId)) || Number(bookingId) <= 0) {
    throw new Error('A valid reservation is required.');
  }
  return api.post(`/admin/reservations/${bookingId}/cancel`);
}

export async function fetchManagedUsers() {
  const response = await api.get('/admin/users');
  if (!Array.isArray(response.data)) {
    throw new Error('The user management service returned an invalid response.');
  }
  return response.data;
}

export async function updateManagedUserRole(userId, role) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) {
    throw new Error('A valid user is required.');
  }
  if (!['Passenger', 'Conductor', 'OperatorAdmin', 'SystemAdmin'].includes(role)) {
    throw new Error('Choose a valid user role.');
  }
  return api.patch(`/admin/users/${userId}/role`, { role });
}

export async function syncBookingsApi(bookings) {
  return api.post('/sync/push', { bookings });
}
