/**
 * Font Awesome(무료) 아이콘을 앱 전역에서 쓰는 이름으로 노출한다.
 * 컴포넌트마다 FontAwesomeIcon 을 직접 쓰지 않고, 여기서 이름 → 아이콘 매핑을 한곳에서 관리한다.
 */
import * as React from "react";
import { FontAwesomeIcon, type FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowLeft,
  faBowlingBall,
  faHammer,
  faTicket,
  faUmbrellaBeach,
  faPersonHiking,
  faHotTubPerson,
  faMasksTheater,
  faCameraRetro,
  faStore,
  faRoad,
  faChildren,
  faPaw,
  faArrowRight,
  faArrowRightFromBracket,
  faArrowUpRightFromSquare,
  faBagShopping,
  faBookmark as faBookmarkSolid,
  faBars,
  faRightToBracket,
  faBarsStaggered,
  faBed,
  faBus,
  faCamera,
  faCar,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faCircleExclamation,
  faCircleNotch,
  faClockRotateLeft,
  faCompass,
  faEllipsis,
  faGripVertical,
  faHeart,
  faHotel,
  faHouse,
  faKey,
  faLandmark,
  faLeaf,
  faLink,
  faList,
  faLocationArrow,
  faLocationDot,
  faMagnifyingGlass,
  faMapLocationDot,
  faMinus,
  faMoon,
  faMountainSun,
  faMugHot,
  faMugSaucer,
  faPalette,
  faPaperPlane,
  faPen,
  faPersonBiking,
  faPersonRunning,
  faPersonWalking,
  faPlus,
  faRotate,
  faRoute,
  faShareNodes,
  faSliders,
  faSquareParking,
  faStar,
  faTrashCan,
  faTriangleExclamation,
  faUserGroup,
  faUserPlus,
  faUtensils,
  faWandMagicSparkles,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import {
  faBookmark,
  faCalendarCheck,
  faCalendarDays,
  faCalendarXmark,
  faClock,
  faComment,
  faFileExcel,
  faImages,
  faLightbulb,
  faMap,
  faNoteSticky,
  faThumbsDown,
  faThumbsUp,
  faUser,
} from "@fortawesome/free-regular-svg-icons";

import { cn } from "@/lib/utils";

export type IconProps = Omit<FontAwesomeIconProps, "icon">;
export type LucideIcon = React.ComponentType<IconProps>;

function make(def: IconDefinition, name: string): LucideIcon {
  const C = ({ className, ...rest }: IconProps) => (
    <FontAwesomeIcon icon={def} className={cn("h-4 w-4", className)} {...rest} />
  );
  C.displayName = name;
  return C;
}

// 기존 화면에서 쓰던 이름 → Font Awesome 아이콘
export const Activity = make(faClockRotateLeft, "Activity");
export const Menu = make(faBars, "Menu");
export const LogIn = make(faRightToBracket, "LogIn");
export const AlarmClockOff = make(faMugHot, "AlarmClockOff");
export const AlertCircle = make(faCircleExclamation, "AlertCircle");
export const AlertTriangle = make(faTriangleExclamation, "AlertTriangle");
export const ArrowLeft = make(faArrowLeft, "ArrowLeft");
export const IndoorPlay = make(faBowlingBall, "IndoorPlay");
export const Workshop = make(faHammer, "Workshop");
export const ThemePark = make(faTicket, "ThemePark");
export const Beach = make(faUmbrellaBeach, "Beach");
export const Hiking = make(faPersonHiking, "Hiking");
export const Spa = make(faHotTubPerson, "Spa");
export const Show = make(faMasksTheater, "Show");
export const PhotoSpot = make(faCameraRetro, "PhotoSpot");
export const Market = make(faStore, "Market");
export const Drive = make(faRoad, "Drive");
export const Kids = make(faChildren, "Kids");
export const Pet = make(faPaw, "Pet");
export const ArrowRight = make(faArrowRight, "ArrowRight");
export const BadgeCheck = make(faCircleCheck, "BadgeCheck");
export const Bookmark = make(faBookmark, "Bookmark");
export const BookmarkFilled = make(faBookmarkSolid, "BookmarkFilled");
export const BedDouble = make(faBed, "BedDouble");
export const Bike = make(faPersonBiking, "Bike");
export const Bus = make(faBus, "Bus");
export const CalendarCheck = make(faCalendarCheck, "CalendarCheck");
export const CalendarDays = make(faCalendarDays, "CalendarDays");
export const CalendarRange = make(faCalendarDays, "CalendarRange");
export const CalendarX2 = make(faCalendarXmark, "CalendarX2");
export const Camera = make(faCamera, "Camera");
export const Car = make(faCar, "Car");
export const Check = make(faCheck, "Check");
export const CheckCircle2 = make(faCircleCheck, "CheckCircle2");
export const ChevronDown = make(faChevronDown, "ChevronDown");
export const ChevronLeft = make(faChevronLeft, "ChevronLeft");
export const ChevronRight = make(faChevronRight, "ChevronRight");
export const Clock = make(faClock, "Clock");
export const Coffee = make(faMugSaucer, "Coffee");
export const Compass = make(faCompass, "Compass");
export const ExternalLink = make(faArrowUpRightFromSquare, "ExternalLink");
export const FileSpreadsheet = make(faFileExcel, "FileSpreadsheet");
export const Footprints = make(faPersonWalking, "Footprints");
export const GripVertical = make(faGripVertical, "GripVertical");
export const Heart = make(faHeart, "Heart");
export const History = make(faClockRotateLeft, "History");
export const Home = make(faHouse, "Home");
export const Hotel = make(faHotel, "Hotel");
export const KeyRound = make(faKey, "KeyRound");
export const Landmark = make(faLandmark, "Landmark");
export const LayoutList = make(faList, "LayoutList");
export const Leaf = make(faLeaf, "Leaf");
export const Lightbulb = make(faLightbulb, "Lightbulb");
export const Link2 = make(faLink, "Link2");
export const Loader2 = make(faCircleNotch, "Loader2");
export const LogOut = make(faArrowRightFromBracket, "LogOut");
export const MapIcon = make(faMap, "MapIcon");
export const MapPin = make(faLocationDot, "MapPin");
export const MapPinned = make(faMapLocationDot, "MapPinned");
export const MessageCircle = make(faComment, "MessageCircle");
export const Minus = make(faMinus, "Minus");
export const Moon = make(faMoon, "Moon");
export const MoreHorizontal = make(faEllipsis, "MoreHorizontal");
export const Mountain = make(faMountainSun, "Mountain");
export const Navigation = make(faLocationArrow, "Navigation");
export const Palette = make(faPalette, "Palette");
export const Parking = make(faSquareParking, "Parking");
export const Pencil = make(faPen, "Pencil");
export const Plus = make(faPlus, "Plus");
export const Presentation = make(faImages, "Presentation");
export const RefreshCw = make(faRotate, "RefreshCw");
export const Route = make(faRoute, "Route");
export const Rows3 = make(faBarsStaggered, "Rows3");
export const Running = make(faPersonRunning, "Running");
export const Search = make(faMagnifyingGlass, "Search");
export const Send = make(faPaperPlane, "Send");
export const Share2 = make(faShareNodes, "Share2");
export const ShoppingBag = make(faBagShopping, "ShoppingBag");
export const SlidersHorizontal = make(faSliders, "SlidersHorizontal");
export const Sparkles = make(faWandMagicSparkles, "Sparkles");
export const Star = make(faStar, "Star");
export const StickyNote = make(faNoteSticky, "StickyNote");
export const ThumbsDown = make(faThumbsDown, "ThumbsDown");
export const ThumbsUp = make(faThumbsUp, "ThumbsUp");
export const Trash2 = make(faTrashCan, "Trash2");
export const UserPlus = make(faUserPlus, "UserPlus");
export const UserRound = make(faUser, "UserRound");
export const Users = make(faUserGroup, "Users");
export const Utensils = make(faUtensils, "Utensils");
export const UtensilsCrossed = make(faUtensils, "UtensilsCrossed");
export const X = make(faXmark, "X");
