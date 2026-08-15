import axios from "axios";
import Cookies from "js-cookie";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL && import.meta.env.PROD) {
    // Fail loud instead of silently falling back to localhost:8000, which
    // only ever "works" on a dev machine running the backend locally — on
    // any real deployment it just points every visitor's browser at their
    // own machine and fails with ERR_CONNECTION_REFUSED, which looks
    // identical to a real backend outage and wastes time misdiagnosing.
    console.error(
        "VITE_API_BASE_URL is not set. Set it in your deployment platform's " +
        "environment variables and redeploy — Vite bakes this in at build " +
        "time, so changing the dashboard value alone does not take effect " +
        "until the next build."
    );
}

const axiosClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "ngrok-skip-browser-warning": "true"
    }
})

axiosClient.interceptors.request.use(config => {
    const token = Cookies.get("accessToken");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
})

axiosClient.interceptors.response.use(
    response => {
        return response;
    },
    error => {
        const { response } = error;
        if (response && response.status === 401) {
            Cookies.remove('accessToken');
            Cookies.remove('currentUser');
        }
        return Promise.reject(error);
    }
)

export default axiosClient;