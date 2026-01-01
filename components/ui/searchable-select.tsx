import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./command"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { useDeviceDetect } from "@/hooks/common"

interface SearchableSelectProps {
  options: string[]
  value?: string
  onValueChange?: (value: string) => void
  onClearWithApply?: () => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  onClearWithApply,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const { isMobileDevice } = useDeviceDetect()

  // Reset search when dialog/popover closes
  React.useEffect(() => {
    if (!open) {
      setSearch("")
    }
  }, [open])

  // Reset search when value changes externally (e.g., from clear button)
  React.useEffect(() => {
    if (!value) {
      setSearch("")
    }
  }, [value])

  const filteredOptions = React.useMemo(() => {
    if (!search) return options.sort()
    return options
      .filter((option) =>
        option.toLowerCase().includes(search.toLowerCase())
      )
      .sort()
  }, [options, search])

  const handleClear = () => {
    if (onClearWithApply) {
      onClearWithApply()
    } else {
      onValueChange?.("")
    }
    setOpen(false)
    setSearch("")
  }

  const handleSelect = (option: string) => {
    onValueChange?.(option)
    setOpen(false)
    setSearch("")
  }

  const commandChildren = (
    <>
      <CommandInput 
        placeholder={searchPlaceholder}
        value={search}
        onValueChange={setSearch}
        disabled={disabled}
      />
      <CommandList className={isMobileDevice ? "max-h-[calc(100vh-12rem)]" : "max-h-64"}>
        <CommandEmpty>{emptyMessage}</CommandEmpty>
        <CommandGroup>
          {value && (
            <CommandItem
              value="__clear__"
              onSelect={handleClear}
              disabled={disabled}
            >
              <X className="mr-2 h-4 w-4" />
              Clear selection
            </CommandItem>
          )}
          {filteredOptions.map((option) => (
            <CommandItem
              key={option}
              value={option}
              onSelect={() => handleSelect(option)}
              disabled={disabled}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value === option ? "opacity-100" : "opacity-0"
                )}
              />
              {option}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </>
  )

  // Use Dialog on mobile, Popover on desktop
  if (isMobileDevice) {
    return (
      <>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
          onClick={() => setOpen(true)}
        >
          {value ? value : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        <CommandDialog open={open} onOpenChange={setOpen}>
          {commandChildren}
        </CommandDialog>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          {value ? value : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0"
        side="bottom"
        align="start"
        sideOffset={4}
      >
        <Command>
          {commandChildren}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
