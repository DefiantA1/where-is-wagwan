'use client'

import { AdvancedMarker, APIProvider, Circle, Map, Polyline, useMap } from "@vis.gl/react-google-maps";

import { collection, onSnapshot, orderBy, query, Timestamp, where} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db } from "./firebase/firebase";
import { GPSModal } from "./components/modals/GPSModal";
import { ArrowDownIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";


const zoom = 11

const nukualofa = {
  lat: -21.1394,
  lng: -175.2049, // Nuku'alofa
};

const selectedZoom = 16;

type FocusTarget = {
  lat: number,
  lng: number,
  createdAt: number,
  key: number
};

function startOfDay(date: Date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function DayPicker({ selectedDay, onSelect }: { selectedDay: number, onSelect: (day: number) => void }) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = new Date(selectedDay);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedDate = new Date(selectedDay);
  const label = isSameCalendarDay(selectedDate, new Date())
    ? "Today"
    : selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  useEffect(() => {
    if (!open) {
      return;
    }

    const date = new Date(selectedDay);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current != null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, selectedDay]);

  function shiftDay(amount: number) {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + amount);
    onSelect(startOfDay(next).getTime());
  }

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous day"
        className="flex size-10 items-center justify-center rounded-md bg-white text-neutral-900 shadow-lg"
        onClick={() => shiftDay(-1)}
      >
        <ChevronLeftIcon className="size-5" />
      </button>
      <button
        type="button"
        className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-neutral-900 shadow-lg flex items-center justify-between gap-2"
        onClick={() => setOpen(!open)}
      >
        <p>{label}</p>
        <ChevronDownIcon className="size-4"/>
      </button>
      <button
        type="button"
        aria-label="Next day"
        className="flex size-10 items-center justify-center rounded-md bg-white text-neutral-900 shadow-lg"
        onClick={() => shiftDay(1)}
      >
        <ChevronRightIcon className="size-5" />
      </button>
      {
        open && <div className="absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 rounded-2xl bg-white p-4 text-neutral-900 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-full hover:bg-neutral-100"
              onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}
            >
              ‹
            </button>
            <p className="text-sm font-semibold">
              {visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-full hover:bg-neutral-100"
              onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-neutral-400">
            {weekdays.map((weekday) => <div key={weekday} className="py-1">{weekday}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {
              days.map((day, index) => {
                if (day == null) {
                  return <div key={`empty-${index}`} />;
                }

                const date = new Date(year, month, day);
                const selected = isSameCalendarDay(date, selectedDate);
                const today = isSameCalendarDay(date, new Date());

                return (
                  <button
                    key={day}
                    type="button"
                    className={`mx-auto flex size-9 items-center justify-center rounded-full text-sm ${
                      selected
                        ? "bg-neutral-900 font-semibold text-white"
                        : today
                          ? "font-semibold text-blue-600 hover:bg-neutral-100"
                          : "hover:bg-neutral-100"
                    }`}
                    onClick={() => {
                      onSelect(startOfDay(date).getTime());
                      setOpen(false);
                    }}
                  >
                    {day}
                  </button>
                );
              })
            }
          </div>
        </div>
      }
    </div>
  );
}

function formatGpsTime(millisecondsSinceEpoch: number): string {
  const date = new Date(millisecondsSinceEpoch);
  const now = new Date();
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (minutes < 1) {
    return "moments ago";
  }

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now) && hours < 6) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const clock = date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/[\s\u202f]+/g, "");

  if (isSameDay(date, now)) {
    return `${clock} Today`;
  }

  if (isSameDay(date, yesterday)) {
    return `${clock} Yesterday`;
  }

  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const month = date.toLocaleDateString("en-US", { month: "short" });

  return `${clock} ${weekday}, ${date.getDate()} ${month}`;
}


export default function Home() {
  return (
    <LiveMap/>
  );
}

function MapFocus({ target }: { target: FocusTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (map == null || target == null) {
      return;
    }

    const currentZoom = map.getZoom() ?? zoom;

    map.moveCamera({
      center: { lat: target.lat, lng: target.lng },
      zoom: Math.max(currentZoom, selectedZoom),
    });
  }, [map, target]);

  return null;
}


function LiveMap(){
  // const [wagwanImg, setWagwanImg] = useState(true);
  // const [gps, setGps] = useState<gps[] | null>(null);

  const [trails, setTrails] = useState<Record<string, gps[]> | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<gps[] | null> (null);

  // const [trackers, setTrackers] = useState<string[] | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [focusedPoint, setFocusedPoint] = useState<FocusTarget | null>(null);

  const [myLocation, setMyLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()).getTime());
  const [dismissedEmptyDay, setDismissedEmptyDay] = useState<number | null>(null);
  const isToday = selectedDay === startOfDay(new Date()).getTime();
  const noDataForDay = !isToday && trails != null && Object.keys(trails).length === 0 && dismissedEmptyDay !== selectedDay;
  

  useEffect(() => {
    const gpsCol = collection(db, 'gps');
    const start = selectedDay;
    const end = new Date(selectedDay);
    end.setDate(end.getDate() + 1);

    const q = query(
      gpsCol,
      where('createdAt', '>=', start),
      where('createdAt', '<', end.getTime()),
      orderBy('createdAt', "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => d.data());

      const gpsLists : gps[] = docs.map((d) => {
        const gps : gps = {
          'createdAt': d.createdAt,
          'found': d.found,
          'id': d.id,
          'lat': d.lat,
          'lng': d.lng,
          'ts': (d.ts as Timestamp).toDate()
        }

        return gps;
      })
      .filter((g) => g.found);

      const gpsIds = gpsLists.map((g) => g.id);
      const uniqueIds = [...(new Set(gpsIds))];
      
      // setTrackers(uniqueIds);
      // setGps(gpsLists);

      const _trails : Record<string, gps[]> = {};

      for (let i = 0; i < gpsLists.length; i++) {
        const gps : gps = gpsLists[i];

        if(_trails[gps.id] == null){
          _trails[gps.id] = [];
        }

        _trails[gps.id].push(gps);
      }

      setTrails(_trails);

    });

    return () => {
      unsub();
    };
  }, [selectedDay])

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setMyLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [])

  return (
    <div>
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY!}>
        <div className="relative">
          {/* {
            trackers != null && <div className="z-2 absolute top-2 h-12 w-full flex gap-2 pl-2 items-center">
              <img src={'/logo.png'} width={45}/>
            </div>
          } */}
          {
            trails != null && <div className="z-2 absolute top-2 h-12 w-full flex gap-2 pl-2 items-center">
              <img src={'/logo.png'} width={45}/>
            </div>
          }
          <div className="absolute top-2 left-1/2 z-20 -translate-x-1/2">
            <DayPicker
              selectedDay={selectedDay}
              onSelect={(day) => {
                setSelectedDay(day);
                setTrails(null);
                setFocusedPoint(null);
                setSelectedTrail(null);
                setIsOpen(false);
              }}
            />
          </div>
          <Map
            style={{width: '100vw', height: '100vh'}}
            mapId={process.env.NEXT_PUBLIC_MAP_ID!}
            defaultCenter={nukualofa}
            defaultZoom={zoom}
            gestureHandling='greedy'
            colorScheme="DARK"
            disableDefaultUI
          >
            <MapFocus target={focusedPoint}/>
            {
              focusedPoint != null && <AdvancedMarker
                position={{ lat: focusedPoint.lat, lng: focusedPoint.lng }}
                anchorLeft="-50%"
                anchorTop="-8px"
                zIndex={20}
                clickable={false}
              >
                <div className="flex flex-col items-center">
                  <span
                    className="block size-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: "#305df2", boxShadow: "0 0 10px #305df2" }}
                  />
                  <div className="relative mt-3 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-lg">
                    <span className="absolute left-1/2 bottom-full -translate-x-1/2 border-x-8 border-b-8 border-x-transparent border-b-white" />
                    {formatGpsTime(focusedPoint.createdAt)}
                  </div>
                </div>
              </AdvancedMarker>
            }
            {
              trails != null && <>
                {
                  Object.keys(trails).map((trackerId,i) => (
                    <div key={trackerId}>
                      <TrackerMarker 
                        latestGPS={trails[trackerId][0]} 
                        trail={trails[trackerId]}
                        index={i}
                      />
                      <Polyline
                        path={trails[trackerId].map((gps) => {
                          return {
                            lat: gps.lat,
                            lng: gps.lng
                          };
                        })}
                        strokeColor={checkWagwanTracker(trackerId) ? '#f23a30' : '#305df2'}
                        strokeWeight={4}
                      />
                    </div>
                  ))
                }
                <MyMarker/>
              </>
            }
            {/* {
              gps != null && <>
                <TrackerMarker/>
                <Polyline
                  path={gps.map((g) => {
                    return {
                      lat: g.lat,
                      lng: g.lng
                    };
                  })}
                  strokeColor={'#f2c130'}
                  strokeWeight={4}
                />
                <MyMarker/>
              </>
            } */}
          </Map>
          {
            noDataForDay && <div
              className="fixed inset-0 z-30 flex items-center justify-center bg-black/50"
              onClick={() => setDismissedEmptyDay(selectedDay)}
            >
              <div
                className="mx-6 w-full max-w-sm rounded-2xl bg-white p-6 text-neutral-900 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-base font-semibold">No data for that day</p>
                <button
                  type="button"
                  className="mt-5 w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white"
                  onClick={() => setDismissedEmptyDay(selectedDay)}
                >
                  OK
                </button>
              </div>
            </div>
          }
          <GPSModal
            isOpen={isOpen}
            exit={() => setIsOpen(false)}
            gps={selectedTrail}
            onSelect={(point) => {
              setFocusedPoint({
                lat: point.lat,
                lng: point.lng,
                createdAt: point.createdAt,
                key: Date.now(),
              });
            }}
          />
          
        </div>
      </APIProvider>
    </div>
  );

  function MyMarker(){
    return (
      <>  
        {
          myLocation != null && <AdvancedMarker 
              position={myLocation}
            >
              <div className="relative flex items-center justify-center">
                <span
                  className="absolute size-8 animate-ping rounded-full opacity-40"
                  style={{ backgroundColor: "#3eb06b" }}
                />
                <span
                  className={`relative block size-3.5 rounded-full border-2 ${
                      "scale-125 ring-2 ring-white/30" 
                  }`}
                  style={{
                    backgroundColor: "#3eb06b",
                    borderColor: `#ffffff99`,
                    boxShadow: `0 0 12px #ffffff66`,
                  }}
                />
              </div>
          </AdvancedMarker>
        }
      </>
    );
  }

  type TrackerMarkerProps = {
    latestGPS: gps,
    trail: gps[],
    index: number
  }

  function checkWagwanTracker(id : string){
    const isWagwanTracker : boolean = ("0C8A0F43CA48" == id);
    return isWagwanTracker;
  }

  function TrackerMarker({latestGPS, trail, index} : TrackerMarkerProps){
    
    // const latestGPS = {lat: gps![0].lat, lng: gps![0].lng};

    const isWagwanTracker = checkWagwanTracker(latestGPS.id);
    
    return (
      <>
        {
            // wagwanImg 
            //   ? 
              <AdvancedMarker
                  className="cursor-pointer"
                  position={latestGPS}
                  onClick={() => {
                    setIsOpen(true);
                    setSelectedTrail(trail);
                  }}
                >
                  <img src={"car-marker.png"} width={120} height={120} />
                </AdvancedMarker>
              // : <AdvancedMarker
              //     className="cursor-pointer"
              //     position={latestGPS}
              //     onClick={() => setWagwanImg(!wagwanImg)}
              //   ></AdvancedMarker>
          }
      </>
    );
  }
}