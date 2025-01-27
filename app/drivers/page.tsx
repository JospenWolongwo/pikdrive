"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Star, MapPin, Car, Shield } from "lucide-react"

const drivers = [
  {
    id: 1,
    name: "Jean Paul",
    image: "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?auto=format&fit=crop&q=80&w=150&h=150",
    rating: 4.8,
    trips: 156,
    location: "Douala",
    vehicle: "Toyota Corolla",
    languages: ["English", "French"],
    verified: true
  },
  {
    id: 2,
    name: "Marie Claire",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150",
    rating: 4.9,
    trips: 203,
    location: "Yaoundé",
    vehicle: "Honda Civic",
    languages: ["French", "English"],
    verified: true
  },
  {
    id: 3,
    name: "Emmanuel",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150",
    rating: 4.7,
    trips: 128,
    location: "Douala",
    vehicle: "Hyundai Elantra",
    languages: ["French", "English"],
    verified: true
  },
  {
    id: 4,
    name: "Sophie",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150&h=150",
    rating: 4.9,
    trips: 175,
    location: "Yaoundé",
    vehicle: "Toyota Camry",
    languages: ["French", "English"],
    verified: true
  }
]

const cities = ["All Cities", "Douala", "Yaoundé", "Bafoussam", "Bamenda", "Kribi"]
const languages = ["All Languages", "English", "French"]
const ratings = ["All Ratings", "4.5+", "4.0+", "3.5+"]

export default function DriversPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCity, setSelectedCity] = useState("All Cities")
  const [selectedLanguage, setSelectedLanguage] = useState("All Languages")
  const [selectedRating, setSelectedRating] = useState("All Ratings")

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = driver.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCity = selectedCity === "All Cities" || driver.location === selectedCity
    const matchesLanguage = selectedLanguage === "All Languages" || driver.languages.includes(selectedLanguage)
    const matchesRating = selectedRating === "All Ratings" || driver.rating >= parseFloat(selectedRating)
    return matchesSearch && matchesCity && matchesLanguage && matchesRating
  })

  return (
    <div className="container py-16 space-y-8">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Our Professional Drivers</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Meet our verified and experienced drivers who ensure safe and comfortable journeys.
        </p>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Search</label>
            <Input
              placeholder="Search drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">City</label>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger>
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((language) => (
                  <SelectItem key={language} value={language}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Rating</label>
            <Select value={selectedRating} onValueChange={setSelectedRating}>
              <SelectTrigger>
                <SelectValue placeholder="Select rating" />
              </SelectTrigger>
              <SelectContent>
                {ratings.map((rating) => (
                  <SelectItem key={rating} value={rating}>
                    {rating}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Drivers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDrivers.map((driver) => (
          <Card key={driver.id} className="p-6">
            <div className="flex items-start space-x-4">
              <img
                src={driver.image}
                alt={driver.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold">{driver.name}</h3>
                  {driver.verified && (
                    <Shield className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex items-center space-x-1 text-sm">
                  <Star className="w-4 h-4 fill-primary text-primary" />
                  <span>{driver.rating}</span>
                  <span className="text-muted-foreground">({driver.trips} trips)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{driver.location}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Car className="w-4 h-4 text-muted-foreground" />
                <span>{driver.vehicle}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">Languages:</span>
                <span className="text-muted-foreground">{driver.languages.join(", ")}</span>
              </div>
            </div>

            <Button className="w-full mt-4">Book a Ride</Button>
          </Card>
        ))}
      </div>
    </div>
  )
}