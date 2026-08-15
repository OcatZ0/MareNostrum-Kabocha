import { createBrowserRouter, Navigate } from "react-router-dom";
import DefaultLayout from "./Layout/DefaultLayout";
import GuestLayout from "./Layout/GuestLayout";
import Login from "./Pages/Login";
import LandingPage from "./Pages/LandingPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <GuestLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "landing-page",
        element: <LandingPage />,
      },
      {
        path: "login",
        element: <Login />,
      },
    ],
  },
  {
    path: "/app",
    element: <DefaultLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/" replace />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default router;