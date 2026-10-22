'use client'

import { config } from "@fortawesome/fontawesome-svg-core";
import { faLocationArrow, faPause, faSquareParking } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { db } from "@/app/firebase/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { ChevronDown, Circle, LocateFixedIcon, LucideCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

config.autoAddCss = false;


const stationaryMeters = 3;
const stationaryMs = 10 * 60 * 1000;
const parkedMs = 30 * 60 * 1000;
const fiveMinutesMs = 5 * 60 * 1000;

type GPSModalProps = {
  isOpen: boolean,
  exit: () => void,
  gps: gps[] | null,
  onSelect: (point: gps) => void
}

type GpsGroupKind = "moving" | "stationary" | "parked";

type GpsGroup = {
  kind: GpsGroupKind,
  focus: gps,
  points: gps[],
  startedAt: number,
  endedAt: number,
}

function formatDuration(startedAt: number, endedAt: number): string {
  const elapsed = Math.max(0, endedAt - startedAt);
  const minutes = Math.floor(elapsed / 60000);

  if (minutes < 60) {
    const shown = elapsed > 0 && minutes < 1 ? 1 : minutes;
    return `${shown} minute${shown === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

function pointsAtLeastFiveMinutesApart(points: gps[]): gps[] {
  const newestFirst = [...points].sort((a, b) => b.createdAt - a.createdAt);
  const listed: gps[] = [];

  for (const point of newestFirst) {
    const previous = listed[listed.length - 1];

    if (previous == null || previous.createdAt - point.createdAt >= fiveMinutesMs) {
      listed.push(point);
    }
  }

  return listed;
}

function distanceMeters(a: gps, b: gps) {
  const earthRadius = 6371000;
  const toRadians = Math.PI / 180;
  const latitudeDelta = (b.lat - a.lat) * toRadians;
  const longitudeDelta = (b.lng - a.lng) * toRadians;
  const latitudeA = a.lat * toRadians;
  const latitudeB = b.lat * toRadians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function pointsAreWithinThreeMeters(cluster: gps[], point: gps) {
  return cluster.every((member) => distanceMeters(member, point) <= stationaryMeters);
}

function groupGpsPoints(points: gps[]): GpsGroup[] {
  const ordered = [...points].sort((a, b) => a.createdAt - b.createdAt);
  const groups: GpsGroup[] = [];

  let index = 0;
  while (index < ordered.length) {
    const cluster: gps[] = [ordered[index]];
    let end = index;

    while (end + 1 < ordered.length) {
      const next = ordered[end + 1];
      const gap = next.createdAt - ordered[end].createdAt;

      if (gap >= parkedMs || !pointsAreWithinThreeMeters(cluster, next)) {
        break;
      }

      cluster.push(next);
      end += 1;
    }

    const span = cluster[cluster.length - 1].createdAt - cluster[0].createdAt;
    const next = ordered[end + 1];
    const parkedAfter = next != null && next.createdAt - ordered[end].createdAt >= parkedMs;
    const latest = cluster[cluster.length - 1];
    const previous = groups[groups.length - 1];
    const lonePointBeforeParkedGap = cluster.length === 1 && parkedAfter;
    const otherSideOfParkedGap = previous?.kind === "parked"
      && cluster.length === 1
      && !parkedAfter
      && end === ordered.length - 1;

    if (span >= stationaryMs) {
      groups.push({
        kind: "stationary",
        focus: latest,
        points: cluster,
        startedAt: cluster[0].createdAt,
        endedAt: latest.createdAt,
      });
    } else if (otherSideOfParkedGap && previous != null) {
      previous.points.push(latest);
    } else if (!lonePointBeforeParkedGap) {
      if (previous?.kind === "moving") {
        previous.points.push(...cluster);
        previous.focus = latest;
        previous.endedAt = latest.createdAt;
      } else {
        groups.push({
          kind: "moving",
          focus: latest,
          points: [...cluster],
          startedAt: cluster[0].createdAt,
          endedAt: latest.createdAt,
        });
      }
    }

    if (parkedAfter && next != null) {
      groups.push({
        kind: "parked",
        focus: latest,
        points: [latest],
        startedAt: latest.createdAt,
        endedAt: next.createdAt,
      });
    }

    index = end + 1;
  }

  return groups.reverse();
}

export function GPSModal({isOpen, exit, gps, onSelect} : GPSModalProps){
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
            assetMap != null && gps != null && groupGpsPoints(gps).map((group, index) => (
              <GPSItem key={`${group.kind}-${group.focus.createdAt}-${index}`} group={group} assetMap={assetMap} onSelect={onSelect}/>
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


}

function GPSItem({group, assetMap, onSelect} : {group: GpsGroup, assetMap: Record<string, string>, onSelect: (point: gps) => void}) {
  const [open, setOpen] = useState(false);
  const label = group.kind === "moving"
    ? "Moving"
    : group.kind === "stationary"
      ? "Stationary"
      : "Parked";
  const headerIcon = group.kind === "moving"
    ? faLocationArrow
    : group.kind === "stationary"
      ? faPause
      : faSquareParking;
  const headerIconColor = group.kind === "moving"
    ? "text-green-500"
    : group.kind === "stationary"
      ? "text-yellow-500"
      : "text-blue-600";
  const points = pointsAtLeastFiveMinutesApart(group.points);

  return (
    <div className="mb-4 border-b border-gray-500 pb-3 text-gray-700">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
          {label}
          <FontAwesomeIcon icon={headerIcon} className={`size-4 ${headerIconColor}`} />
        </span>
        <span className="text-sm">{formatDuration(group.startedAt, group.endedAt)}</span>
      </button>
      {
        open && <div className="mt-3 pl-6">
          {
            points.map((point) => (
              <button
                key={`${point.createdAt}-${point.id}`}
                type="button"
                className="flex w-full cursor-pointer items-end justify-between gap-3 border-t border-gray-200 py-3 text-left"
                onClick={() => onSelect(point)}
              >
                <span className="text-sm">{assetMap[point.id] ?? point.id}</span>
                <span className="text-sm">{formatTimestamp(point.createdAt)}</span>
              </button>
            ))
          }
        </div>
      }
    </div>
  );

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