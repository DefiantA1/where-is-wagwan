'use client'

import { AdvancedMarker, APIProvider, Circle, Map, Polyline } from "@vis.gl/react-google-maps";

import { collection, getDocs, limit, onSnapshot, orderBy, query, Timestamp, where} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase/firebase";


const zoom = 11

const nukualofa = {
  lat: -21.1394,
  lng: -175.2049, // Nuku'alofa
};


export default function Home() {
  return (
    <LiveMap/>
  );
}


function LiveMap(){
  const [wagwanImg, setWagwanImg] = useState(true);
  const [gps, setGps] = useState<gps[] | null>(null);

  const [trackers, setTrackers] = useState<string[] | null>(null);
  

  useEffect(() => {
    const gpsCol = collection(db, 'gps');
    const q = query(
      gpsCol,
      orderBy('createdAt', "desc"),
      limit(60)
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
      
      setTrackers(uniqueIds);
      setGps(gpsLists);
    });

    return () => unsub();
  }, [])

  return (
    <div>
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY!}>
        <div className="relative">
          {
            trackers != null && <div className="z-2 absolute top-2 h-12 w-full flex gap-2 pl-2 items-center">
              <img src={'/logo.png'} width={45}/>
              {
                trackers.map((t) => (
                  <div key={t} className="border border-blue-400 p-2 rounded-xl flex">
                    <p className="">{t}</p>
                  </div>
                ))
              }
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
            {
              gps != null && <>
                <WagwanMarker/>
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
              </>
            }
          </Map>
        </div>
      </APIProvider>
    </div>
  );

  function WagwanMarker(){
    
    const latestGPS = {lat: gps![0].lat, lng: gps![0].lng};
    
    return (
      <>
        {
            wagwanImg 
              ? <AdvancedMarker
                  className="cursor-pointer"
                  position={latestGPS}
                  onClick={() => setWagwanImg(!wagwanImg)}
                >
                  <img src="/wagwan-large.png" width={120} height={120} />
                </AdvancedMarker>
              : <AdvancedMarker
                  className="cursor-pointer"
                  position={latestGPS}
                  onClick={() => setWagwanImg(!wagwanImg)}
                ></AdvancedMarker>
          }
      </>
    );
  }
}