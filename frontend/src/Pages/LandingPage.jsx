import React from 'react';

const LandingPage = () => {
    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#fff',
            fontFamily: 'Arial, sans-serif'
        }}>
            <div style={{ textAlign: 'center', maxWidth: '700px', padding: '32px' }}>
                <p style={{ letterSpacing: '0.2em', textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '16px' }}>
                    Welcome
                </p>
                <h1 style={{ fontSize: '3rem', margin: '0 0 16px' }}>MareNostrum Kabocha</h1>
                <p style={{ fontSize: '1.1rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                    Selamat datang di halaman utama aplikasi. Landing page ini sudah bisa tampil dengan benar.
                </p>
            </div>
        </main>
    );
};

export default LandingPage;
