import React from 'react';
import { Outlet } from 'react-router-dom';

const DefaultLayout = () => {
    return (
        <div className="default-layout">
            <Outlet />
        </div>
    );
};

export default DefaultLayout;
