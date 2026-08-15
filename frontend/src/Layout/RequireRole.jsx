import React from 'react';
import { Navigate } from 'react-router-dom';
import { useStateContext } from '../Contexts/Context';

/**
 * Route guard: redirects to /login if nobody's authenticated, or to the
 * other side's dashboard if the logged-in user's role doesn't match —
 * e.g. a driver hitting /app/* lands back on /driver instead of seeing
 * admin pages. userToken/currentUser are cookie-backed (Contexts/Context.jsx),
 * so this is synchronous on page load, no loading flicker.
 */
const RequireRole = ({ role, children }) => {
  const { currentUser, userToken } = useStateContext();

  if (!userToken) {
    return <Navigate to="/login" replace />;
  }

  if (role && currentUser?.role !== role) {
    // Route to the side matching the known role; anything unrecognized
    // (e.g. a token without a matching currentUser) goes to /login rather
    // than guessing — guessing wrong here would bounce between /app and
    // /driver forever since both guards would keep rejecting it.
    if (currentUser?.role === 'admin') return <Navigate to="/app" replace />;
    if (currentUser?.role === 'driver') return <Navigate to="/driver" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default RequireRole;
