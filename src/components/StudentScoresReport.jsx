import React, { useState, useEffect } from 'react';
import api from '../services/api';

const StudentScoresReport = ({ matricNo }) => {
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!matricNo) return;

        setLoading(true);
        api.get(`/students/${matricNo}/scores-report`)
            .then(response => {
                setReportData(response.data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.response?.data?.error || err.message || 'Failed to fetch scores report');
                setLoading(false);
            });
    }, [matricNo]);

    if (loading) return <p className="text-center">Loading scores report...</p>;
    if (error) return <p className="text-center text-red-500">Error: {error}</p>;
    if (!reportData || !reportData.coursesByYear || !reportData.allAttempts) return <p className="text-center">No report data found.</p>;

    const { coursesByYear, allAttempts } = reportData;

    const groupedByYear = coursesByYear.reduce((acc, course) => {
        const year = course.COURSE_YEAR || 'Uncategorized';
        if (!acc[year]) {
            acc[year] = [];
        }
        acc[year].push(course);
        return acc;
    }, {});
    
    const yearOrder = ['Year 1', 'Year 2', 'Year 3', 'Compulsory', 'Uncategorized'];
    const sortedYearKeys = Object.keys(groupedByYear).sort((a, b) => {
        const aIndex = yearOrder.indexOf(a);
        const bIndex = yearOrder.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
    });

    const renderValue = (value) => value === null || value === undefined || value === "" ? "-" : value.toString();

    return (
        <div className="flex flex-col gap-8">
            {/* Table 1: Courses by Year with Result from Attempt 3 */}
            <div className="bg-white p-5 rounded-lg shadow border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">Course Results by Year</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {sortedYearKeys.map(year => (
                        groupedByYear[year] && groupedByYear[year].length > 0 && (
                            <div key={year} className="flex flex-col bg-gray-50 rounded-lg shadow-inner">
                                <h4 className="text-md font-bold mb-2 text-center bg-gray-200 p-2 rounded-t-lg text-gray-700">{year}</h4>
                                <div className="p-2 flex-grow overflow-y-auto" style={{maxHeight: '400px'}}>
                                    <ul className="divide-y divide-gray-200">
                                        {groupedByYear[year].map(course => (
                                            <li key={course.COURSE_CODE} className="py-3 px-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <div className="flex-1 overflow-hidden mr-2">
                                                        <p className="font-medium text-gray-800 truncate" title={course.COURSE_CODE}>{course.COURSE_CODE}</p>
                                                        <p className="text-gray-500 truncate" title={course.MODULE}>{renderValue(course.MODULE)}</p>
                                                    </div>
                                                    <p className="font-bold text-lg ml-2 text-gray-800">{renderValue(course.RESULT)}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            </div>

            {/* Table 2: All Attempts */}
            <div className="bg-white p-5 rounded-lg shadow border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">Detailed Course Attempts</h3>
                <div className="overflow-x-auto overflow-y-auto" style={{maxHeight: '400px'}}>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Code</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Attempt 1</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Attempt 2</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Attempt 3</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {allAttempts.map(course => (
                                <tr key={course.COURSE_CODE}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{renderValue(course.COURSE_CODE)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{renderValue(course.MODULE)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{renderValue(course.ATTEMPT_1)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{renderValue(course.ATTEMPT_2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{renderValue(course.ATTEMPT_3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StudentScoresReport;
