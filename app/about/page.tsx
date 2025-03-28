"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Shield, Clock, Heart } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function AboutPage() {
  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  };

  const stats = [
    { number: "50K+", label: "Happy Riders", icon: Users },
    { number: "1000+", label: "Verified Drivers", icon: Shield },
    { number: "100+", label: "Cities", icon: MapPin },
    { number: "24/7", label: "Support", icon: Clock },
  ];

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container">
          <motion.div
            initial="initial"
            animate="animate"
            variants={fadeIn}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Our Mission</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Making intercity travel in Cameroon safe, reliable, and accessible
              for everyone.
            </p>
            <div className="flex justify-center gap-4">
              <Button size="lg" asChild>
                <a href="#team">Meet Our Team</a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/contact">Contact Us</a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
                  {stat.icon && <stat.icon className="w-8 h-8" />}
                </div>
                <h3 className="text-3xl font-bold mb-2">{stat.number}</h3>
                <p className="text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-muted">
        <div className="container">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-center mb-12"
          >
            Our Values
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Safety First",
                description:
                  "We prioritize the safety of our riders and drivers above everything else.",
              },
              {
                title: "Community",
                description:
                  "Building connections and fostering a sense of community in every city we serve.",
              },
              {
                title: "Innovation",
                description:
                  "Continuously improving our platform to provide the best travel experience.",
              },
            ].map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 h-full">
                  <h3 className="text-xl font-semibold mb-4">{value.title}</h3>
                  <p className="text-muted-foreground">{value.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Join Our Journey
            </h2>
            <p className="text-lg mb-8 max-w-2xl mx-auto">
              Be part of the transportation revolution in Cameroon
            </p>
            <Button size="lg" variant="secondary" asChild>
              <a href="/contact">
                <Heart className="mr-2 h-4 w-4" />
                Get in Touch
              </a>
            </Button>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
