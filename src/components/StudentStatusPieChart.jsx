import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

const StudentStatusPieChart = ({ data }) => {
  const palette = [
    '#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6',
    '#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
    '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A',
    '#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
    '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC',
    '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
    '#E666B3', '#33991A', '#CC9999', '#B3B31A', '#00E680',
    '#4D8066', '#809980', '#E6FF80', '#1AFF33', '#999933',
    '#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3',
    '#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF'
  ];

  if (!data) {
    return <div>Loading chart data...</div>;
  }

  const backgroundColors = data.map((_, index) => palette[index % palette.length]);
  const borderColors = backgroundColors.map(color => color.replace('0.2', '1'));

  const chartData = {
    labels: data.map(item => item.STUDENT_STATUS),
    datasets: [
      {
        label: '# of Students',
        data: data.map(item => item.count),
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Student Status Distribution',
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += context.parsed;
            }
            const total = context.dataset.data.reduce((acc, value) => acc + value, 0);
            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(2) + '%' : '0%';
            label += ` (${percentage})`;
            return label;
          },
        },
      },
    },
  };

  return <Pie data={chartData} options={options} />;
};

export default StudentStatusPieChart;
