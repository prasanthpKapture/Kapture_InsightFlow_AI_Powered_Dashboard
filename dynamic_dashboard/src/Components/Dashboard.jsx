import { React, useEffect, useState } from "react";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchConfigData } from "../reducers/Getconfig";
import { fetchDashboardData } from "../reducers/dashboardfetch";
import { deleteDashboard } from "../reducers/deleteDashboardSlice"; 
import DynamicAutoCharts from "../charts/DynamicAutoChart";

const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dashboardToDelete, setDashboardToDelete] = useState(null);

  const [chatButtonPosition, setChatButtonPosition] = useState({
    x: window.innerWidth - 100,
    y: window.innerHeight - 100,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const dashboardConfigState = useSelector((state) => state.dashboardConfig);
  const dashboardDataState = useSelector((state) => state.dashboardData);

  useEffect(() => {
    dispatch(fetchConfigData());
  }, [dispatch]);

  useEffect(() => {
    const handleResize = () => {
      setChatButtonPosition((prev) => ({
        x: Math.min(prev.x, window.innerWidth - 80),
        y: Math.min(prev.y, window.innerHeight - 80),
      }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const rect = e.target.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    setChatButtonPosition({
      x: Math.max(0, Math.min(newX, window.innerWidth - 80)),
      y: Math.max(0, Math.min(newY, window.innerHeight - 80)),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e) => {
    setIsDragging(true);
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    e.preventDefault();
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragOffset.x;
    const newY = touch.clientY - dragOffset.y;
    setChatButtonPosition({
      x: Math.max(0, Math.min(newX, window.innerWidth - 80)),
      y: Math.max(0, Math.min(newY, window.innerHeight - 80)),
    });
    e.preventDefault();
  };

  const handleTouchEnd = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [isDragging, dragOffset]);

  // Get unique thread IDs and their dashboard names
  const getThreadButtons = () => {
    const responseData = dashboardConfigState.data?.data;
    if (!responseData || typeof responseData !== "object") return [];

    return Object.entries(responseData).map(([threadId, configArray]) => {
      const dashboardName =
        configArray[0]?.dashboardName || `Thread ${threadId}`;
      return {
        threadId,
        dashboardName,
        configArray,
      };
    });
  };

  const getDataObjects = () => {
    const responseData = dashboardConfigState.data?.data;
    if (!responseData || typeof responseData !== "object" || !selectedThreadId)
      return [];

    const configArray = responseData[selectedThreadId];
    if (!configArray) return [];

    let hasThreadNameBeenUsed = false;
    return configArray
      .filter((config) => config && config.enabled)
      .map((config) => {
        let parsedPayload = {};
        try {
          parsedPayload = JSON.parse(config.payload || "{}");
        } catch (error) {
          console.error(
            "Error parsing payload for config ID:",
            config.id,
            error
          );
        }
        const showThreadName =
          !hasThreadNameBeenUsed && configArray[0]?.dashboardName;
        hasThreadNameBeenUsed = true;
        return {
          key: `${selectedThreadId}_${config.id}`,
          label: showThreadName || "",
          threadId: selectedThreadId,
          chartType: config.chartType || "bar",
          keyToFieldList: parsedPayload || {},
          apiPayload: { keyToFieldList: parsedPayload || {} },
          config,
          id: config.id,
          createdAt: config.createdAt,
        };
      })
      .sort((a, b) => a.id - b.id);
  };

  const threadButtons = getThreadButtons();
  const dataObjects = getDataObjects();

  // Auto-select first thread when config data is loaded
  useEffect(() => {
    if (
      dashboardConfigState.status === "succeeded" &&
      threadButtons.length > 0 &&
      !selectedThreadId
    ) {
      const firstThread = threadButtons[0];
      handleThreadButtonClick(firstThread.threadId, firstThread.configArray);
    }
  }, [dashboardConfigState.status, threadButtons.length, selectedThreadId]);

  // Handle thread button click - fetch dashboard data for selected thread
  const handleThreadButtonClick = (threadId, configArray) => {
    setSelectedThreadId(threadId);

    // Fetch dashboard data for all items in the selected thread
    configArray.forEach((item) => {
      if (item && item.enabled) {
        dispatch(
          fetchDashboardData({
            id: item.id,
            payload: JSON.parse(item.payload || "{}"),
          })
        );
      }
    });
  };

  // Handle delete dashboard
  const handleDeleteDashboard = (threadId) => {
    setDashboardToDelete(threadId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (dashboardToDelete) {
      dispatch(deleteDashboard(dashboardToDelete)).then(() => {
        // If the deleted dashboard was selected, clear selection
        if (selectedThreadId === dashboardToDelete) {
          setSelectedThreadId(null);
        }
        // Refresh the config data to update the sidebar
        dispatch(fetchConfigData());
      });
    }
    setShowDeleteConfirm(false);
    setDashboardToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDashboardToDelete(null);
  };

  // Separate table charts from other charts
  const separateChartsByType = () => {
    const charts = [];
    const tables = [];

    dataObjects.forEach((item) => {
      const id = item.id;
      const chartData = dashboardDataState.dataMap?.[id];
      const status = dashboardDataState.statusMap?.[id];

      if (status === "succeeded" && chartData) {
        const chartItem = {
          ...item,
          chartData,
          status,
        };

        // Check if it's a table chart type
        if (item.chartType === "table" || item.chartType === "datatable") {
          tables.push(chartItem);
        } else {
          charts.push(chartItem);
        }
      }
    });

    return { charts, tables };
  };

  const { charts, tables } = separateChartsByType();

  const selectedThread = selectedThreadId
    ? threadButtons.find((t) => t.threadId === selectedThreadId)
    : null;

  return (
    <div className="fixed h-full w-full flex overflow-hidden">
      {/* Delete Confirmation Toast */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 m-4 max-w-md w-full transform transition-all">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <DeleteIcon className="w-5 h-5 text-red-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Dashboard
                </h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-gray-700">
                Are you sure you want to delete this dashboard? All associated
                data and configurations will be permanently removed.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors duration-200"
              >
                Delete Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div
        className={`group fixed inset-y-0 left-0 z-40 bg-white shadow-md transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:translate-x-0 w-40`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-lg font-semibold">Dashboards</span>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
            <CloseIcon />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-2 space-y-2">
          {dashboardConfigState.status === "loading" && <p>Loading...</p>}
          {dashboardConfigState.status === "failed" && (
            <p className="text-red-500">{dashboardConfigState.error}</p>
          )}
          {dashboardConfigState.status === "succeeded" && (
            <div className="space-y-2">
              {threadButtons.map((thread) => (
                <div
                  key={thread.threadId}
                  className={`rounded-md border p-2 ${
                    selectedThreadId === thread.threadId
                      ? "bg-blue-50 border-blue-300"
                      : "hover:bg-gray-50 border-gray-200"
                  }`}
                >
                  <button
                    onClick={() =>
                      handleThreadButtonClick(
                        thread.threadId,
                        thread.configArray
                      )
                    }
                    className="text-left text-sm font-medium truncate text-gray-800 w-full"
                  >
                    {thread.dashboardName}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white shadow">
          <button onClick={() => setIsSidebarOpen(true)}>
            <MenuIcon />
          </button>
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </div>

        {/* Floating Chat Button */}
        <button
          onClick={() => !isDragging && navigate("/chat")}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`fixed bg-[#db3700] hover:bg-[#c12e00] text-white p-4 rounded-full shadow-lg transition-transform duration-200 z-50 group ${
            isDragging
              ? "cursor-grabbing scale-105"
              : "cursor-grab hover:scale-105"
          }`}
          style={{
            left: `${chatButtonPosition.x}px`,
            top: `${chatButtonPosition.y}px`,
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <ChatBubbleOutlineIcon className="w-6 h-6 pointer-events-none" />
          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {isDragging ? "Release to place" : "Click for Chat"}
          </span>
        </button>

        {/* Charts Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Dashboard Header with Delete Button */}
          {selectedThread && (
            <div className="text-center mb-8 py-6 relative">
              {/* Delete Button - positioned at top-left of the header */}
              <button
                onClick={() => handleDeleteDashboard(selectedThread.threadId)}
                className="absolute top-0 left-0 bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-2 shadow-md transition-colors duration-200 flex items-center gap-2 text-sm font-medium"
                title="Delete Dashboard"
              >
                <DeleteIcon className="w-4 h-4" />
                Delete Dashboard
              </button>

              {/* Dashboard Title */}
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4 tracking-wide">
                {selectedThread.dashboardName}
              </h1>
              <div className="w-32 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
              <div className="mt-2 text-gray-500 text-lg font-light tracking-widest uppercase">
                Dashboard Analytics
              </div>
            </div>
          )}

          {/* Grid Layout for Charts (Non-table charts) */}
          {charts.length > 0 && (
            <div
              className={`grid gap-1 mb-8 ${
                charts.length === 1
                  ? "grid-cols-1 place-items-center"
                  : "grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2"
              }`}
            >
              {charts.map((item) => (
                <div
                  key={item.id}
                  className={`p-0 ${
                    charts.length === 1 ? "max-w-2xl w-full" : ""
                  }`}
                >
                  <DynamicAutoCharts
                    apiResponse={item.chartData}
                    api_payload={item.keyToFieldList}
                    chartType={item.chartType}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Full Width Layout for Tables */}
          {tables.length > 0 && (
            <div className="space-y-6">
              {tables.map((item) => (
                <div key={item.id} className=" rounded-lg shadow-md  p-4">
                  <DynamicAutoCharts
                    apiResponse={item.chartData}
                    api_payload={item.keyToFieldList}
                    chartType={item.chartType}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Error states for failed charts */}
          {dataObjects.map((item) => {
            const id = item.id;
            const status = dashboardDataState.statusMap?.[id];

            if (status === "failed") {
              return (
                <div
                  key={id}
                  className="text-red-500 text-center py-4 bg-red-50 rounded-lg border border-red-200"
                >
                  Failed to load data for {item.label}.
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
