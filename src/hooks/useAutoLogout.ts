// import { useEffect, useRef } from "react";
// import { useNavigate } from "react-router-dom";
// import api from "../api/api";
// import { useAuthStore } from "../store/authStore";

// const TIMEOUT = 30 * 60 * 1000; // 30 minutes
// // const TIMEOUT = 20 * 1000; // for testing

// export const useAutoLogout = () => {
//     const timerRef = useRef<number | null>(null);
//     const navigate = useNavigate();
//     const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
//     const logoutStore = useAuthStore((s) => s.logout);

//     // ----------------
//     // perform logout via API
//     // ----------------
//     const doLogout = async () => {
//         const accessToken = localStorage.getItem("accessToken");
//         const refreshToken = localStorage.getItem("refreshToken");

//         if (accessToken) {
//             try {
//                 await api.post("auth/logout/", {
//                     token: accessToken,
//                     refresh: refreshToken,
//                 });
//             } catch (e) {
//                 console.log("Logout API error", e);
//             }
//         }

//         sessionStorage.clear();
//         localStorage.removeItem("accessToken");
//         localStorage.removeItem("refreshToken");
//         logoutStore();
//         navigate("/login", { replace: true });
//     };

//     // ----------------
//     // inactivity timer
//     // ----------------
//     const startTimer = () => {
//         if (timerRef.current) clearTimeout(timerRef.current);
//         timerRef.current = window.setTimeout(doLogout, TIMEOUT);
//     };


//     // ----------------
//     // tab/browser close (ignore F5)
//     // ----------------
//     const handleBeforeUnload = () => {
//         const accessToken = localStorage.getItem("accessToken");
//         const refreshToken = localStorage.getItem("refreshToken");
//         if (!accessToken) return;


//         // Check if it's a reload/refresh
//         const navigationType = (performance as any)?.getEntriesByType?.("navigation")?.[0]?.type
//             || (performance as any)?.navigation?.type;


//         // 0 = normal navigation (enter URL), 1 = reload, 2 = back/forward
//         if (navigationType === "reload" && navigationType == 0) return;

//         fetch("https://api.initcart.in/api/pos/auth/logout/", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ token: accessToken, refresh: refreshToken }),
//             keepalive: true, // ensures request is sent
//         });

//         // clear tokens so next open shows login page
//         localStorage.removeItem("accessToken");
//         localStorage.removeItem("refreshToken");
//         sessionStorage.clear();
//         logoutStore();

//     };

//     useEffect(() => {
//         if (!isAuthenticated) return;

//         const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
//         events.forEach((e) => window.addEventListener(e, startTimer));

//         window.addEventListener("beforeunload", handleBeforeUnload);

//         startTimer();

//         return () => {
//             events.forEach((e) => window.removeEventListener(e, startTimer));
//             window.removeEventListener("beforeunload", handleBeforeUnload);
//             if (timerRef.current) clearTimeout(timerRef.current);
//         };
//     }, [isAuthenticated]);

//     // ----------------
//     // on app mount, force login if no token
//     // ----------------
//     useEffect(() => {
//         const token = localStorage.getItem("accessToken");
//         //const hasReloaded = sessionStorage.getItem("hasReloaded");

//         if (!token) {
//             logoutStore();
//             navigate("/login", { replace: true });
//         }
//     }, []);


//     // useEffect(() => {
//     //     const hasReloaded = sessionStorage.getItem("hasReloaded");
//     //     if (!hasReloaded) {
//     //         sessionStorage.setItem("hasReloaded", "true");
//     //         window.location.reload();
//     //     }
//     // }, []);
// };

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuthStore } from "../store/authStore";

const TIMEOUT = 30 * 60 * 1000; // 30 min
// const TIMEOUT = 20 * 1000;

export const useAutoLogout = () => {
    const timerRef = useRef<number | null>(null);
    const navigate = useNavigate();

    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const logoutStore = useAuthStore((s) => s.logout);

    // ----------------
    // logout API
    // ----------------
    const doLogout = async () => {
        const accessToken = sessionStorage.getItem("accessToken");
        const refreshToken = sessionStorage.getItem("refreshToken");

        try {
            if (accessToken) {
                await api.post("auth/logout/", {
                    token: accessToken,
                    refresh: refreshToken,
                });
            }
        } catch (e) {
            console.log("Logout API error", e);
        }

        sessionStorage.clear();
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");

        logoutStore();
        navigate("/login", { replace: true });
    };

    // ----------------
    // inactivity timer
    // ----------------
    const startTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(doLogout, TIMEOUT);
    };

    // ----------------
    // activity listeners
    // ----------------
    useEffect(() => {
        if (!isAuthenticated) return;

        const events = ["mousemove","mousedown","keydown","scroll","touchstart"];

        events.forEach((e) => window.addEventListener(e, startTimer));
        startTimer();

        return () => {
            events.forEach((e) => window.removeEventListener(e, startTimer));
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isAuthenticated]);

    // ----------------
    // HEARTBEAT (only when logged in)
    // ----------------
    useEffect(() => {
        if (!isAuthenticated) return;

        const interval = setInterval(() => {
            const token = sessionStorage.getItem("accessToken");
            if (!token) return;

            fetch("https://api.initcart.in/api/pos/heartbeat/", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
        }, 60000);

        return () => clearInterval(interval);
    }, [isAuthenticated]);

    // ----------------
    // force login if token missing
    // ----------------
    useEffect(() => {
        const token = sessionStorage.getItem("accessToken");

        if (!token) {
            logoutStore();
            navigate("/login", { replace: true });
        }
    }, []);
};
