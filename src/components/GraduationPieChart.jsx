import React, { useState, useEffect, useRef } from "react";
import { Pie, getElementAtEvent } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import api from "../services/api";
import GraduationStatusModal from "./GraduationStatusModal";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

const GraduationPieChart = () => {
  const [chartData, setChartData] = useState(null);
  const [onTimeStudents, setOnTimeStudents] = useState([]);
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState('on-time');
  const chartRef = useRef(null);

  useEffect(() => {
    const fetchGraduationData = async () => {
      try {
        const response = await api.get("/predictions/all-students");
        const { summary, predictions } = response.data;

        const data = {
          labels: ["On Time", "At Risk"],
          datasets: [
            {
              label: "Students",
              data: [summary.on_time_predicted, summary.at_risk_predicted],
              backgroundColor: ["#4CAF50", "#F44336"],
              borderColor: ["#FFFFFF", "#FFFFFF"],
              borderWidth: 1,
            },
          ],
        };

        setChartData(data);
        
        const onTime = predictions
          .filter(student => student.prediction_label === 'On Time')
          .map(student => ({ StudentID: student.matric_no, StudentName: student.name }));

        const atRisk = predictions
          .filter(student => student.prediction_label === 'At Risk')
          .map(student => ({ StudentID: student.matric_no, StudentName: student.name }));

        setOnTimeStudents(onTime);
        setAtRiskStudents(atRisk);
      } catch (error) {
        console.error("Error fetching graduation data:", error);
      }
    };

    fetchGraduationData();
  }, []);

  const handleClick = (event) => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    const element = getElementAtEvent(chart, event);

    if (element.length > 0) {
        const { index } = element[0];
        const clickedLabel = chartData.labels[index];

        if (clickedLabel === 'On Time') {
            setInitialTab('on-time');
        } else if (clickedLabel === 'At Risk') {
            setInitialTab('at-risk');
        }
        setIsModalOpen(true);
    }
  };

  if (!chartData) {
    return <p>Loading graduation data...</p>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Students Graduating On-Time",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed !== null) {
              label += context.parsed;
            }
            const total = context.dataset.data.reduce((acc, value) => acc + value, 0);
            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(2) + "%" : "0%";
            label += ` (${percentage})`;
            return label;
          },
        },
      },
    },
  };

  return (
    <>
      <Pie ref={chartRef} data={chartData} options={options} onClick={handleClick} />
      <GraduationStatusModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onTimeStudents={onTimeStudents}
          atRiskStudents={atRiskStudents}
          initialTab={initialTab}
      />
    </>
  );
};

export default GraduationPieChart;
