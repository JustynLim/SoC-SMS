import React, { useEffect, useState } from 'react';

// Icons
import { MdInfo, MdInsertChart, MdMenuOpen, MdOutlineSettings } from "react-icons/md";
import { IoHomeOutline } from "react-icons/io5";
import { TbReportSearch } from "react-icons/tb";
import { BiImport, BiLogOut } from "react-icons/bi";
import { TbBook2 } from "react-icons/tb";
import { HiOutlineUserGroup } from "react-icons/hi2";
import { IoIosArrowDown } from "react-icons/io";
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { icons: <IoHomeOutline size={24} />, label: 'Home', path: '/home' },
  { icons: <TbBook2 size={24} />, label: 'Course Structure', path: '/course-structure' },
  { icons: <BiImport size={24} />, label: 'Import', path: '/import' },
  {
    icons: <HiOutlineUserGroup size={24} />,
    label: 'Students',
    children: [
      { icons: <MdInfo size={20} />, label: 'Student Info', path: '/students-info' },
      { icons: <MdInsertChart size={20} />, label: 'Student Scores', path: '/students-scores' },
    ],
  },
  { icons: <TbReportSearch size={24} />, label: 'Generate list', path: '/generate-list' },
  { icons: <MdOutlineSettings size={24} />, label: 'Admin settings', path: '/admin-settings' },
];

const MenuItem = ({ item, open, openSubmenus, toggleSubmenu, location }) => {
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    const baseItemClasses = "flex items-center w-full no-underline duration-300 rounded-lg px-4 py-3";
    const collapsedTextClasses = `whitespace-nowrap transition-opacity duration-300 ${!open ? "opacity-0 w-0" : "opacity-100"}`;

    if (!hasChildren) {
        return (
            <li className="my-1">
                <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                        `${baseItemClasses} ${open ? "justify-start gap-4" : "justify-center"} ${
                            isActive ? "bg-blue-800 text-white font-semibold" : "text-white hover:bg-blue-700"
                        }`
                    }
                >
                    <div className="min-w-[24px] flex items-center justify-center">{item.icons}</div>
                    <p className={collapsedTextClasses}>{item.label}</p>
                </NavLink>
            </li>
        );
    }

    const isSubmenuOpen = openSubmenus[item.label] || false;

    if (open) {
        return (
            <li className="my-1">
                <button
                    type="button"
                    onClick={() => toggleSubmenu(item.label)}
                    className={`${baseItemClasses} justify-between w-full text-white bg-transparent hover:bg-transparent`}
                >
                    <span className="flex items-center gap-4">
                        <div className="min-w-[24px] flex items-center justify-center">{item.icons}</div>
                        <p className={collapsedTextClasses}>{item.label}</p>
                    </span>
                    <IoIosArrowDown
                        size={16}
                        className={`transition-transform duration-300 ${isSubmenuOpen ? "rotate-180" : ""}`}
                    />
                </button>
                <div
                    className={`overflow-hidden transition-[max-height,opacity] duration-500 ease-in-out ${
                        isSubmenuOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                    } ml-6 pl-6 border-l border-blue-500`}
                >
                    <ul className="py-1">
                        {item.children.map((child, cIdx) => (
                            <li key={cIdx} className="my-1">
                                <NavLink
                                    to={child.path}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 w-full no-underline duration-300 rounded-lg px-3 py-2 ${
                                            isActive ? "bg-blue-800 text-white font-semibold" : "text-white hover:bg-blue-700"
                                        }`
                                    }
                                >
                                    <div className="min-w-[20px] flex items-center justify-center">{child.icons}</div>
                                    <p className="whitespace-nowrap">{child.label}</p>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
            </li>
        );
    }

    // Collapsed parent item
    return (
        <li className="my-1 relative group">
            <div className={`${baseItemClasses} justify-center text-white`}>
                <div className="min-w-[24px] flex items-center justify-center">{item.icons}</div>
            </div>
            <div
                className="absolute left-full top-0 w-56 bg-blue-800 rounded-r-lg shadow-lg p-2
                           opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto
                           transition-all duration-300 z-10"
            >
                <p className="font-bold text-white px-3 py-2">{item.label}</p>
                <ul>
                    {item.children.map((child, cIdx) => (
                        <li key={cIdx} className="my-1">
                            <NavLink
                                to={child.path}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 w-full no-underline duration-300 rounded-lg px-3 py-2 ${
                                        isActive ? "bg-blue-900 text-white font-semibold" : "text-white hover:bg-blue-700"
                                    }`
                                }
                            >
                                <div className="min-w-[20px] flex items-center justify-center">{child.icons}</div>
                                <p>{child.label}</p>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </div>
        </li>
    );
};

export default function Sidebar() {
    const [open, setOpen] = useState(() => {
        try {
            const saved = localStorage.getItem("sidebar-open");
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });
    const [openSubmenus, setOpenSubmenus] = useState({});
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        localStorage.setItem("sidebar-open", JSON.stringify(open));
    }, [open]);

    useEffect(() => {
        const activeSubmenus = {};
        navItems.forEach(item => {
            if (item.children && item.children.some(child => location.pathname.startsWith(child.path))) {
                activeSubmenus[item.label] = true;
            }
        });
        setOpenSubmenus(prev => ({ ...prev, ...activeSubmenus }));
    }, [location.pathname]);

    const toggleSubmenu = (label) => {
        setOpenSubmenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    const logout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <aside className={`h-screen flex flex-col bg-blue-600 text-white transition-all duration-300 ease-in-out ${open ? "w-64" : "w-24"}`}>
            <header className="p-4 h-20 flex items-center justify-between relative group">
                {open ? (
                    <>
                        <h1 className="font-bold text-xl tracking-wide">SoC SMS</h1>
                        <button onClick={() => setOpen(!open)} className="p-2 rounded-lg bg-transparent hover:bg-transparent">
                            <MdMenuOpen size={24} className={`transition-transform duration-300 ${!open && "rotate-180"}`} />
                        </button>
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="font-bold text-xl absolute opacity-100 group-hover:opacity-0 transition-opacity duration-300">
                            SoC
                        </span>
                        <button onClick={() => setOpen(!open)} className="p-2 rounded-lg bg-transparent hover:bg-transparent absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <MdMenuOpen size={24} className={`transition-transform duration-300 ${!open && "rotate-180"}`} />
                        </button>
                    </div>
                )}
            </header>

            <nav className="flex-1 px-2">
                <ul>
                    {navItems.map((item, index) => (
                        <MenuItem
                            key={index}
                            item={item}
                            open={open}
                            openSubmenus={openSubmenus}
                            toggleSubmenu={toggleSubmenu}
                            location={location}
                        />
                    ))}
                </ul>
            </nav>

            <footer className="p-2">
                <div onClick={logout} className={`flex items-center w-full cursor-pointer no-underline duration-300 rounded-lg px-4 py-3 hover:bg-red-100 group ${open ? "gap-4" : "justify-center"}`}>
                    <div className="min-w-[24px] flex items-center justify-center text-red-600">
                        <BiLogOut size={24} />
                    </div>
                    <p className={`whitespace-nowrap font-semibold transition-opacity duration-300 text-red-600 ${!open ? "opacity-0 w-0" : "opacity-100"}`}>
                        Logout
                    </p>
                </div>
            </footer>
        </aside>
    );
}