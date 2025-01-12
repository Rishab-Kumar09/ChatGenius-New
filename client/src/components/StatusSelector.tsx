import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusSelectorProps {
  currentStatus: 'online' | 'busy' | 'offline';
  onStatusChange: (status: 'online' | 'busy' | 'offline') => void;
  className?: string;
}

export function StatusSelector({ currentStatus, onStatusChange, className }: StatusSelectorProps) {
  const handleStatusChange = (value: string) => {
    console.log('StatusSelector: status change requested', value);
    onStatusChange(value as 'online' | 'busy' | 'offline');
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'busy':
        return 'Busy';
      case 'offline':
        return 'Offline';
    }
  };

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
    >
      <SelectTrigger className={cn("w-[120px] h-7 text-sm", className)}>
        <SelectValue>
          <div className="flex items-center gap-2">
            <Circle className={cn(
              "h-3 w-3 fill-current",
              currentStatus === 'online' && "text-green-500",
              currentStatus === 'busy' && "text-yellow-500",
              currentStatus === 'offline' && "text-red-500"
            )} />
            <span className="text-black">{getStatusText(currentStatus)}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="online" className="text-black">
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 text-green-500 fill-current" />
            <span>Online</span>
          </div>
        </SelectItem>
        <SelectItem value="busy" className="text-black">
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 text-yellow-500 fill-current" />
            <span>Busy</span>
          </div>
        </SelectItem>
        <SelectItem value="offline" className="text-black">
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 text-red-500 fill-current" />
            <span>Offline</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}