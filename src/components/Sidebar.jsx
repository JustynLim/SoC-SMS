import React, { useState } from 'react'
import logo from '../logo.png';

// Icons
import { MdMenuOpen, MdInfo, MdInsertChart } from "react-icons/md";
import { IoHomeOutline } from "react-icons/io5";
//import { FaProductHunt } from "react-icons/fa";
import { FaUserCircle } from "react-icons/fa";
import { TbReportSearch } from "react-icons/tb";
//import { IoLogoBuffer } from "react-icons/io";
import { CiSettings } from "react-icons/ci";
import { CiLogout } from "react-icons/ci";
//import { MdOutlineDashboard } from "react-icons/md";
import { BiImport } from "react-icons/bi"
import { TbBook2 } from "react-icons/tb"
import { HiOutlineUserGroup } from "react-icons/hi2"
import { IoIosArrowDown } from "react-icons/io" //new
import { LiaClipboardListSolid } from 'react-icons/lia'; 
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'; //remove link after testing


const navItems = [
  { icons: <IoHomeOutline size={30} />, label: 'Home', path: '/home' },
  { icons: <TbBook2 size={30} />, label: 'Course Structure', path: '/course-structure' },
  { icons: <BiImport size={30} />, label: 'Import', path: '/import' },
  {
    icons: <HiOutlineUserGroup size={30} />,
    label: 'Students',
    // no path here so parent doesn't navigate/highlight
    children: [
      { icons: <MdInfo size={30} />, label: 'Student Info', path: '/students-info' },
      { icons: <MdInsertChart size={30} />, label: 'Student Scores', path: '/students-scores' },
    ],
  },
  { icons: <TbReportSearch size={30} />, label: 'Generate list', path: '/generate-list' },
  { icons: <CiSettings size={30} />, label: 'Admin settings' },
];

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const [openStudents, setOpenStudents] = useState(false); //new
  const navigate = useNavigate();
  const location = useLocation(); //new
  
  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
    };

    // All 3 function's new
    const isStudentsChildActive = location.pathname.startsWith("/students-info") || location.pathname.startsWith("/students-scores"); // used for optional arrow accent
    
    // auto-open submenu when user is on one of its routes
    React.useEffect(() => {
        if (isStudentsChildActive) setOpenStudents(true);
    }, [isStudentsChildActive]);

    const baseItem = "flex items-center gap-3 w-full no-underline duration-300 rounded-full px-3 py-2";
    const collapsedText = `${!open ? "w-0 translate-x-24" : ""} duration-500 overflow-hidden`;
    
    return (
    <nav
        className={`shadow-md h-screen p-1 flex flex-col duration-500 bg-blue-600 text-white ${
        open ? "w-60" : "w-16"
        }`}
    >
        {/* Header */}
        <div className="px-3 py-2 my-2 h-12 flex items-center justify-between group relative">
        {open ? (
            // Expanded → show text left + menu icon right
            <>
            <span className="font-bold text-lg tracking-wide">SoC SMS</span>
            <MdMenuOpen
                size={24}
                className="cursor-pointer"
                onClick={() => setOpen(!open)}
            />
            </>
        ) : (
            // Collapsed -> show SoC text (fade out on hover) OR menu icon (fade in on hover)
            <div className="flex items-center justify-center w-full h-full relative">
            {/* SoC text */}
            <span
                className="absolute font-bold text-lg tracking-wide 
                        opacity-100 group-hover:opacity-0 
                        transition-opacity duration-300"
            >
                SoC
            </span>

            {/* Menu icon */}
            <MdMenuOpen
                size={24}
                className="absolute opacity-0 group-hover:opacity-100 
                        transition-opacity duration-300 cursor-pointer"
                onClick={() => setOpen(!open)}
            />
            </div>
        )}
        </div>
        
    {/* Updated Body with drop down for students */}
      <ul className="flex-1">
        {navItems.map((item, index) => {
          const hasChildren = Array.isArray(item.children) && item.children.length > 0;

          // Simple leaf item
          if (!hasChildren && item.path) {
            return (
              <li key={index} className="my-2 duration-300 cursor-pointer relative group">
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `${baseItem} ${open ? "justify-start" : "justify-center"} ${
                      isActive ? "bg-blue-800 text-white" : "text-white hover:bg-blue-700"
                    }`
                  }
                >
                  <div className="w-6 h-6 flex items-center justify-center">{item.icons}</div>
                  <p className={collapsedText}>{item.label}</p>
                </NavLink>
              </li>
            );
          }

          // Parent with children: button to toggle, no NavLink so it never highlights
          if (hasChildren) {
            return (
              <li key={index} className="my-2 duration-300 relative">
                <button
                  type="button"
                  onClick={() => setOpenStudents((v) => !v)}
                  className={`${baseItem} ${open ? "justify-between" : "justify-center"} text-white bg-transparent hover:bg-transparent active:bg-transparent focus:bg-transparent focus:outline-none w-full`}
                >
                  <span className="flex items-center gap-3">
                    <div className="w-6 h-6 flex items-center justify-center">{item.icons}</div>
                    <p className={collapsedText}>{item.label}</p>
                  </span>
                  {open && (
                    <IoIosArrowDown
                      size={18}
                      className={`transition-transform duration-300 ${openStudents ? "rotate-180" : ""} ${
                        isStudentsChildActive ? "text-white" : "text-white/80"
                      }`}
                    />
                  )}
                </button>

                {/* Submenu container with smooth collapse */}
                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                    openStudents && open ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                  } ${open ? "pl-10 pr-3" : ""}`}
                >
                  <ul className="mt-1">
                    {item.children.map((child, cIdx) => (
                      <li key={cIdx} className="my-1">
                        <NavLink
                          to={child.path}
                          className={({ isActive }) =>
                            `${baseItem} ${open ? "justify-start" : "justify-center"} ${
                              isActive ? "bg-blue-800 text-white" : "text-white hover:bg-blue-700"
                            }`
                          }
                          // keep active state for deep paths like /student-info/123
                          // by default NavLink matches by "startsWith" unless end is true
                        >
                        {/* Use the same wrapper everywhere */}
                        <span className="w-6 h-6 flex items-center justify-center">
                        {/* If child.icons exists, render it; else, fallback */}
                        {child.icons
                            ? React.cloneElement(child.icons, { size: 20 }) // 20 fits nicely in a 24px box
                            : <span className="text-base leading-none">{child.iconText ?? "•"}</span>}
                        </span>

                          <p className={collapsedText}>{child.label}</p>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          }

          // Fallback for any item without path and without children (current plain div)
          return (
            <li key={index} className="my-2 duration-300 cursor-pointer relative group">
              <div className="flex items-center gap-3 text-white rounded-full px-3 py-2">
                <div className="w-6 h-6 flex items-center justify-center">{item.icons}</div>
                <p className={collapsedText}>{item.label}</p>
              </div>
            </li>
          );
        })}
      </ul>

        {/* Footer */}
        <div onClick={logout} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-red-100 rounded-full transition-colors duration-200">
            <div>
                <CiLogout size={30} className="text-red-600" />
            </div>
            <div
                className={`leading-5 ${!open && "w-0 translate-x-24"} 
                duration-500 overflow-hidden`}
            >
                <p className="font-medium text-red-600">Logout</p>
            </div>
        </div>
    </nav>
    );
}