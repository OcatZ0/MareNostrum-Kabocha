import { createContext, useContext, useState } from "react";
import Cookies from "js-cookie";

const StateContext = createContext({
    currentUser: {},
    userToken: null,
    Toast: {
        message: '',
        color: '',
        show: false,
    },
    loading: true,
    setLoading: () => {},
    setToken: () => {},
    setToast: () => {},
    setCurrentUser: () => {},
    setUserToken: () => {}
})

export const ContextProvider = ({ children }) => {
    const [currentUser, setCurrentUserState] = useState(() => {
        const saved = Cookies.get("currentUser");
        return saved ? JSON.parse(saved) : {};
    });
    const [userToken, setUserToken] = useState(Cookies.get("accessToken"));
    const [toast, setToast] = useState({ message: '', color: '', show: false });
    const [loading, setLoading] = useState(true);

    const setToken = (token) => {
        if (token) {
            Cookies.set('accessToken', token);
        } else {
            Cookies.remove('accessToken');
        }
        setUserToken(token);
    };

    const setCurrentUser = (user) => {
        if (user && Object.keys(user).length > 0) {
            Cookies.set('currentUser', JSON.stringify(user));
        } else {
            Cookies.remove('currentUser');
        }
        setCurrentUserState(user);
    };

    const showToast = (message, color) => {
        setToast({ message: message, color: color, show: true });
        setTimeout(() => {
            setToast({ message: '', color: '', show: false });
        }, 6000);
    };

    return (
        <StateContext.Provider
            value={{
                currentUser,
                userToken,
                toast,
                loading,
                setLoading,
                setCurrentUser,
                setUserToken,
                setToken,
                setToast,
                showToast
            }}
        >
            {children}
        </StateContext.Provider>
    );
}

export const useStateContext = () => useContext(StateContext);