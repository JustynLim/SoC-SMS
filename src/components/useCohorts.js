import { useEffect, useState } from "react";

export default function useCohorts(){
    const [cohorts, setCohorts] = useState([]);
    const [loadingCohorts, setLoading] = useState(true);
    const [errorCohorts, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        fetch("http://localhost:5001/api/cohorts", {signal: controller.signal})
            .then(res => {
                if (!res.ok) throw new Error(`Failed to fetch cohorts: ${res.status}`);
                return res.json();
            })
            .then(json => {
                setCohorts(Array.isArray(json) ? json.map(String) : []);
                setLoading(false);
            })
            .catch(err => {
                if(err.name ==="AbortError") return;
                setError(err.message);
                setLoading(false);
            });
            return () => controller.abort();
    }, []);
    return {cohorts, loadingCohorts, errorCohorts};
}