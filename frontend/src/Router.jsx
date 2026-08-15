import { createBrowserRouter, Navigate } from "react-router-dom";
import DefaultLayout       from "./Layout/DefaultLayout";
import GuestLayout         from "./Layout/GuestLayout";
import RequireRole         from "./Layout/RequireRole";
import Login               from "./Pages/Login";
import LandingPage         from "./Pages/LandingPage";
import Dashboard           from "./Pages/Dashboard";
import TripsPage           from "./Pages/TripsPage";
import TrucksPage          from "./Pages/TrucksPage";
import DriversPage         from "./Pages/DriversPage";
import DriverActorPage     from "./Pages/DriverActorPage";
import DriverDashboard     from "./Pages/DriverDashboard";
import CompaniesPortsPage  from "./Pages/CompaniesPortsPage";
import NotificationsPage   from "./Pages/NotificationsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <GuestLayout />,
    children: [
      { index: true,           element: <LandingPage /> },
      { path: "landing-page",  element: <LandingPage /> },
      { path: "login",         element: <Login /> },
    ],
  },
  {
    path: "/app",
    element: <RequireRole role="admin"><DefaultLayout /></RequireRole>,
    children: [
      { index: true,                  element: <Dashboard /> },
      { path: "dashboard",            element: <Dashboard /> },
      { path: "trips",                element: <TripsPage /> },
      { path: "trucks",               element: <TrucksPage /> },
      { path: "drivers",              element: <DriversPage /> },
      { path: "driversPage",          element: <DriverActorPage /> },
      { path: "companies-ports",      element: <CompaniesPortsPage /> },
      { path: "notifications",        element: <NotificationsPage /> },
    ],
  },
  {
    path: "/driver",
    element: <RequireRole role="driver"><DriverDashboard /></RequireRole>,
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default router;
