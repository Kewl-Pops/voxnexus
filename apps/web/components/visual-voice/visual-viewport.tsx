// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { useState, useEffect, useCallback } from "react";
import { useDataChannel } from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as Icons from "@/components/icons";

// =============================================================================
// Visual Voice Protocol Types
// =============================================================================

export type VisualComponentType = "calendar" | "form" | "map" | "confirm" | "list";

export interface VisualUIMessage {
  type: "show_component" | "hide_component" | "update_component";
  component: VisualComponentType;
  props: Record<string, unknown>;
  id?: string;
}

export interface CalendarProps {
  title?: string;
  minDate?: string;
  maxDate?: string;
  selectedDate?: string;
  availableDates?: string[];
  onSelect?: (date: string) => void;
}

export interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "phone" | "number" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For select type
}

export interface FormProps {
  title?: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  onSubmit?: (data: Record<string, string>) => void;
}

export interface MapProps {
  title?: string;
  address?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
}

export interface ConfirmProps {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface ListProps {
  title?: string;
  items: Array<{ id: string; label: string; description?: string }>;
  onSelect?: (id: string) => void;
}

// =============================================================================
// Sub-Components
// =============================================================================

function CalendarView({ props, onResponse }: { props: CalendarProps; onResponse: (data: unknown) => void }) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    props.selectedDate ? new Date(props.selectedDate) : null
  );

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleDateClick = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedDate(date);
  };

  const handleConfirm = () => {
    if (selectedDate) {
      onResponse({ type: "calendar_selected", date: selectedDate.toISOString().split("T")[0] });
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icons.Calendar size={20} />
          {props.title || "Select a Date"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (currentMonth === 0) {
                setCurrentMonth(11);
                setCurrentYear(currentYear - 1);
              } else {
                setCurrentMonth(currentMonth - 1);
              }
            }}
          >
            <Icons.ChevronLeft size={16} />
          </Button>
          <span className="font-medium">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (currentMonth === 11) {
                setCurrentMonth(0);
                setCurrentYear(currentYear + 1);
              } else {
                setCurrentMonth(currentMonth + 1);
              }
            }}
          >
            <Icons.ChevronRight size={16} />
          </Button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <div key={index} className="aspect-square">
              {day && (
                <button
                  onClick={() => handleDateClick(day)}
                  className={`w-full h-full rounded-md text-sm transition-colors ${
                    selectedDate &&
                    selectedDate.getDate() === day &&
                    selectedDate.getMonth() === currentMonth &&
                    selectedDate.getFullYear() === currentYear
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  {day}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Confirm Button */}
        <div className="mt-4 pt-4 border-t">
          <Button className="w-full" onClick={handleConfirm} disabled={!selectedDate}>
            {selectedDate
              ? `Confirm ${selectedDate.toLocaleDateString()}`
              : "Select a date"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FormView({ props, onResponse }: { props: FormProps; onResponse: (data: unknown) => void }) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    props.fields.forEach((field) => {
      if (field.required && !formData[field.name]?.trim()) {
        newErrors[field.name] = `${field.label} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onResponse({ type: "form_submitted", data: formData });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icons.FileText size={20} />
          {props.title || "Fill out the form"}
        </CardTitle>
        {props.description && (
          <p className="text-sm text-muted-foreground">{props.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {props.fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={field.name}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, [field.name]: e.target.value });
                    setErrors({ ...errors, [field.name]: "" });
                  }}
                />
              ) : field.type === "select" ? (
                <select
                  id={field.name}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData[field.name] || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, [field.name]: e.target.value });
                    setErrors({ ...errors, [field.name]: "" });
                  }}
                >
                  <option value="">{field.placeholder || "Select..."}</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <Input
                  id={field.name}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, [field.name]: e.target.value });
                    setErrors({ ...errors, [field.name]: "" });
                  }}
                />
              )}
              {errors[field.name] && (
                <p className="text-xs text-destructive">{errors[field.name]}</p>
              )}
            </div>
          ))}
          <Button type="submit" className="w-full">
            {props.submitLabel || "Submit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MapView({ props }: { props: MapProps }) {
  // Simple map placeholder - in production, integrate with Mapbox/Google Maps
  const mapUrl = props.lat && props.lng
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${props.lng - 0.01},${props.lat - 0.01},${props.lng + 0.01},${props.lat + 0.01}&layer=mapnik&marker=${props.lat},${props.lng}`
    : props.address
    ? `https://www.openstreetmap.org/export/embed.html?bbox=-180,-90,180,90&layer=mapnik`
    : null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icons.MapPin size={20} />
          {props.title || "Location"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {props.address && (
          <p className="text-sm text-muted-foreground mb-3">{props.address}</p>
        )}
        <div className="aspect-video rounded-lg overflow-hidden bg-muted">
          {mapUrl ? (
            <iframe
              src={mapUrl}
              className="w-full h-full border-0"
              loading="lazy"
              title="Location Map"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icons.MapPin size={48} className="text-muted-foreground" />
            </div>
          )}
        </div>
        {props.address && (
          <Button
            variant="outline"
            className="w-full mt-3"
            onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(props.address || "")}`, "_blank")}
          >
            Open in Google Maps
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ConfirmView({ props, onResponse }: { props: ConfirmProps; onResponse: (data: unknown) => void }) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{props.title || "Confirm"}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{props.message}</p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onResponse({ type: "confirm_cancelled" })}
          >
            {props.cancelLabel || "Cancel"}
          </Button>
          <Button
            className="flex-1"
            onClick={() => onResponse({ type: "confirm_accepted" })}
          >
            {props.confirmLabel || "Confirm"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ListView({ props, onResponse }: { props: ListProps; onResponse: (data: unknown) => void }) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icons.List size={20} />
          {props.title || "Select an option"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {props.items.map((item) => (
            <button
              key={item.id}
              onClick={() => onResponse({ type: "list_selected", id: item.id, label: item.label })}
              className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <p className="font-medium text-sm">{item.label}</p>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main VisualViewport Component
// =============================================================================

interface VisualViewportProps {
  onResponse?: (data: unknown) => void;
}

export function VisualViewport({ onResponse }: VisualViewportProps) {
  const [activeComponent, setActiveComponent] = useState<{
    type: VisualComponentType;
    props: Record<string, unknown>;
    id?: string;
  } | null>(null);

  // LiveKit data channel for receiving UI messages
  const { message, send } = useDataChannel("visual_ui", (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload)) as VisualUIMessage;
      handleMessage(data);
    } catch (e) {
      console.error("Failed to parse visual UI message:", e);
    }
  });

  const handleMessage = useCallback((data: VisualUIMessage) => {
    switch (data.type) {
      case "show_component":
        setActiveComponent({
          type: data.component,
          props: data.props,
          id: data.id,
        });
        break;
      case "hide_component":
        setActiveComponent(null);
        break;
      case "update_component":
        if (activeComponent && activeComponent.id === data.id) {
          setActiveComponent({
            type: activeComponent.type,
            id: activeComponent.id,
            props: { ...activeComponent.props, ...data.props },
          });
        }
        break;
    }
  }, [activeComponent]);

  const handleResponse = useCallback((responseData: unknown) => {
    // Send response back via data channel
    const response = {
      type: "ui_response",
      componentId: activeComponent?.id,
      componentType: activeComponent?.type,
      data: responseData,
    };

    send(new TextEncoder().encode(JSON.stringify(response)), { reliable: true });

    // Also call the onResponse callback if provided
    onResponse?.(response);

    // Hide component after response
    setActiveComponent(null);
  }, [activeComponent, send, onResponse]);

  const handleClose = useCallback(() => {
    handleResponse({ type: "ui_dismissed" });
  }, [handleResponse]);

  const renderComponent = () => {
    if (!activeComponent) return null;

    switch (activeComponent.type) {
      case "calendar":
        return <CalendarView props={activeComponent.props as unknown as CalendarProps} onResponse={handleResponse} />;
      case "form":
        return <FormView props={activeComponent.props as unknown as FormProps} onResponse={handleResponse} />;
      case "map":
        return <MapView props={activeComponent.props as unknown as MapProps} />;
      case "confirm":
        return <ConfirmView props={activeComponent.props as unknown as ConfirmProps} onResponse={handleResponse} />;
      case "list":
        return <ListView props={activeComponent.props as unknown as ListProps} onResponse={handleResponse} />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {activeComponent && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="relative">
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute -top-2 -right-2 z-10 rounded-full bg-background border shadow-sm p-1 hover:bg-muted transition-colors"
            >
              <Icons.X size={16} />
            </button>
            {renderComponent()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// Demo/Preview Component (for testing without LiveKit)
// =============================================================================

export function VisualViewportDemo() {
  const [activeDemo, setActiveDemo] = useState<VisualComponentType | null>(null);

  const demoCalendar: CalendarProps = {
    title: "Schedule Appointment",
  };
  const demoForm: FormProps = {
    title: "Contact Information",
    description: "Please provide your details",
    fields: [
      { name: "name", label: "Full Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", type: "phone" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
    submitLabel: "Submit",
  };
  const demoMap: MapProps = {
    title: "Our Location",
    address: "123 Main Street, New York, NY 10001",
    lat: 40.7128,
    lng: -74.0060,
  };
  const demoConfirm: ConfirmProps = {
    title: "Confirm Booking",
    message: "Would you like to confirm your appointment for January 15th at 2:00 PM?",
    confirmLabel: "Yes, confirm",
    cancelLabel: "No, cancel",
  };
  const demoList: ListProps = {
    title: "Select Service",
    items: [
      { id: "1", label: "General Inquiry", description: "Ask about our services" },
      { id: "2", label: "Technical Support", description: "Get help with issues" },
      { id: "3", label: "Sales", description: "Learn about pricing" },
    ],
  };

  const componentTypes: VisualComponentType[] = ["calendar", "form", "map", "confirm", "list"];

  return (
    <div className="space-y-6">
      {/* Demo Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Visual Voice Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {componentTypes.map((type) => (
              <Button
                key={type}
                variant={activeDemo === type ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveDemo(activeDemo === type ? null : type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Demo Component Display */}
      <AnimatePresence>
        {activeDemo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex justify-center"
          >
            {activeDemo === "calendar" && (
              <CalendarView
                props={demoCalendar}
                onResponse={(data) => {
                  console.log("Calendar response:", data);
                  setActiveDemo(null);
                }}
              />
            )}
            {activeDemo === "form" && (
              <FormView
                props={demoForm}
                onResponse={(data) => {
                  console.log("Form response:", data);
                  setActiveDemo(null);
                }}
              />
            )}
            {activeDemo === "map" && <MapView props={demoMap} />}
            {activeDemo === "confirm" && (
              <ConfirmView
                props={demoConfirm}
                onResponse={(data) => {
                  console.log("Confirm response:", data);
                  setActiveDemo(null);
                }}
              />
            )}
            {activeDemo === "list" && (
              <ListView
                props={demoList}
                onResponse={(data) => {
                  console.log("List response:", data);
                  setActiveDemo(null);
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
