'use client'

import { AdvancedMarker, APIProvider, Circle, Map, Polyline, useMap } from "@vis.gl/react-google-maps";

import { collection, getDocs, limit, onSnapshot, orderBy, query, Timestamp, where} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase/firebase";
import { GPSModal } from "./components/modals/GPSModal";


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
  

  useEffect(() => {
    const gpsCol = collection(db, 'gps');

    const minutesInDay = 1440;
    const gpsPointsInDay = minutesInDay * 2;

    const q = query(
      gpsCol,
      orderBy('createdAt', "desc"),
      limit(gpsPointsInDay)
    );

    let watchId: any = null;
    
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


    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setMyLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          // console.error(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );
    }

    return () => {
      unsub();

      if(watchId != null){
        navigator.geolocation.clearWatch(watchId);
      }
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
              setIsOpen(false);
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
                  <img src={isWagwanTracker ? "/wagwan-large.png" : "richie.png"} width={120} height={120} />
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