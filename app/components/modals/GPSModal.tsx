'use client'

import { db } from "@/app/firebase/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { Circle, IdCardIcon, LocateFixedIcon, LucideCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";


type GPSModalProps = {
  isOpen: boolean,
  exit: () => void,
  gps: gps[] | null
}

export function GPSModal({isOpen, exit, gps} : GPSModalProps){
  const [loading, setLoading] = useState<boolean>(false);
  const [assetMap, setAssetMap] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    // if(gps == null){
    //   return;
    // }

    const getAssets = async () => {
      const q = query(collection(db, 'assets'));
      const snapshot = await getDocs(q);

      const docs = snapshot.docs.map((d) => d.data());

      const assets : Record<string, string> = {};
      docs.forEach((d) => {
        const id = d['trackerId'];
        const name = d['name'];

        assets[id] = name;
      });

      setAssetMap(assets);
    }

    getAssets();
  }, [])
  
  function exitModal(){
    setLoading(false);
    exit();
  }

  function slideInformation(){
    return `absolute bottom-0 left-0 lg:left-auto right-0 lg:w-90 lg:top-0 lg:rounded-none lg:pt-18 bg-white rounded-t-3xl p-6 transition-transform duration-300 ease-out text-black ${
      isOpen ? "translate-y-0 lg:translate-y-0 lg:-translate-x-0 h-100 lg:h-full overflow-y-auto"
        : "translate-y-full lg:translate-y-0 lg:translate-x-full"
    }`;
  }
  
  return (
    <div
      className={`fixed inset-0 bg-black/50 transition-opacity ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={() => exitModal()}
    >
      <div
        className={slideInformation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-row justify-between">
          <div className="flex flex-row">
            <h2 className="mr-3" style={{fontWeight: 'bold'}}>GPS</h2>
            <LocateFixedIcon/>
          </div>
          <X className="cursor-pointer" onClick={() => exitModal()}/>
        </div>
        <hr className="mt-2 mb-4"/>
        <div className="overflow-y-hidden">
          {
            gps != null && gps.map((g, i) => (
              <div key={`${g.createdAt}-${g.id}`} className="border-b border-gray-500 mb-4 pb-3 text-gray-700">
                <div className="flex gap-3 justify-between items-end">
                  <div className="flex gap-2 items-center">
                    <IdCardIcon/>
                    <p className="text-sm">{assetMap == null ? g.id : assetMap[g.id]}</p>
                  </div>
                  <p className="text-sm">{formatTimestamp(g.createdAt)}</p>
                </div>
                {
                  i == 0 && <div onClick={() => {
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`,
                      "_blank"
                    );
                  }} className="cursor-pointer bg-blue-400 text-white p-2 mb-1 mt-2 rounded w-fit">
                    Go to Location
                  </div>
                }
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );

  function convertToElasped(ms: number){
    const seconds = Math.floor((Date.now() - ms) / 1000);

    if (seconds < 60) {
      return "moments ago";
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.floor(hours / 24);

    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function AddBtn(){
    return (
      <div 
        onClick={() => {handleAddMarker()}} 
        className="cursor-pointer bg-green-500 w-full p-3 mt-4 rounded text-white font-semibold text-center">
        {loading 
          ? <div className="flex flex-row items-center justify-center">
              <Spinner size="sm"/>
              <p className="ml-2">Loading...</p>
            </div> 
          : <p>Add</p>}
      </div>
    );
  }

  async function handleAddMarker(){
    try{
      
    }
    catch(err){
      toast.error(`${err}`);
    }
  }

  function formatTimestamp(millisecondsSinceEpoch: number): string {
    const date = new Date(millisecondsSinceEpoch);
    const now = new Date();

    const time = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    // Today
    if (isSameDay(date, now)) {
      return `${time} Today`;
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (isSameDay(date, yesterday)) {
      return `${time} Yesterday`;
    }

    // Anything older
    const day = date.toLocaleDateString('en-US', {
      weekday: 'short',
    });

    const month = date.toLocaleDateString('en-US', {
      month: 'short',
    });

    const dayNumber = date.getDate();
    // const year = date.getFullYear();

    const suffix =
      dayNumber % 10 === 1 && dayNumber !== 11 ? 'st' :
      dayNumber % 10 === 2 && dayNumber !== 12 ? 'nd' :
      dayNumber % 10 === 3 && dayNumber !== 13 ? 'rd' :
      'th';

    return `${time} ${day}, ${dayNumber}${suffix} ${month}`;
  }
}

export function Spinner({ size = "md" }) {
  const sizeClasses : any = {
    sm: "h-5 w-5 border-2",
    md: "h-8 w-8 border-4",
    lg: "h-12 w-12 border-4",
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-gray-200 border-t-blue-600`}
      />
    </div>
  );
}