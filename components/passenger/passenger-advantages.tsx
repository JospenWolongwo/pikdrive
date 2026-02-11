"use client"

import { Shield, RefreshCw, Users, Zap, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { Card, Badge, Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui"
import { useLocale } from "@/hooks"
import { motion } from "framer-motion"

export function PassengerAdvantages() {
  const { t } = useLocale();
  
  const advantages = [
    {
      icon: <Shield className="w-8 h-8" />,
      badge: t("pages.passenger.advantages.items.badges.secure"),
      badgeColor: "bg-purple-500",
      title: t("pages.passenger.advantages.items.securePayment"),
      description: t("pages.passenger.advantages.items.securePaymentDescription"),
      gradient: "from-purple-500/10 to-pink-500/5",
      borderColor: "border-purple-200",
      iconBg: "bg-purple-100 dark:bg-purple-900/30"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      badge: t("pages.passenger.advantages.items.badges.protected"),
      badgeColor: "bg-amber-500",
      title: t("pages.passenger.advantages.items.antiFraud"),
      description: t("pages.passenger.advantages.items.antiFraudDescription"),
      gradient: "from-amber-500/10 to-orange-500/5",
      borderColor: "border-amber-200",
      iconBg: "bg-amber-100 dark:bg-amber-900/30"
    },
    {
      icon: <RefreshCw className="w-8 h-8" />,
      badge: t("pages.passenger.advantages.items.badges.instant"),
      badgeColor: "bg-green-500",
      title: t("pages.passenger.advantages.items.instantRefunds"),
      description: t("pages.passenger.advantages.items.instantRefundsDescription"),
      gradient: "from-green-500/10 to-emerald-500/5",
      borderColor: "border-green-200",
      iconBg: "bg-green-100 dark:bg-green-900/30"
    },
    {
      icon: <Users className="w-8 h-8" />,
      badge: t("pages.passenger.advantages.items.badges.flexible"),
      badgeColor: "bg-blue-500",
      title: t("pages.passenger.advantages.items.flexibleSeats"),
      description: t("pages.passenger.advantages.items.flexibleSeatsDescription"),
      gradient: "from-blue-500/10 to-cyan-500/5",
      borderColor: "border-blue-200",
      iconBg: "bg-blue-100 dark:bg-blue-900/30"
    }
  ]

  const [advantagesApi, setAdvantagesApi] = useState<CarouselApi>()
  const [advantagesCurrent, setAdvantagesCurrent] = useState(0)
  const [advantagesCount, setAdvantagesCount] = useState(0)

  useEffect(() => {
    if (!advantagesApi) return

    const onSelect = () => setAdvantagesCurrent(advantagesApi.selectedScrollSnap())

    setAdvantagesCount(advantagesApi.scrollSnapList().length)
    onSelect()

    advantagesApi.on("select", onSelect)
    advantagesApi.on("reInit", onSelect)

    return () => {
      advantagesApi.off("select", onSelect)
      advantagesApi.off("reInit", onSelect)
    }
  }, [advantagesApi])

  const renderAdvantageCard = (advantage: (typeof advantages)[number]) => (
    <Card
      className={`
        relative overflow-hidden h-full
        bg-gradient-to-br ${advantage.gradient}
        border-2 ${advantage.borderColor}
        hover:shadow-xl md:hover:scale-105
        transition-all duration-300
        group
      `}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative p-6 space-y-4">
        {/* Badge */}
        <div className="flex items-center justify-between">
          <Badge
            className={`${advantage.badgeColor} text-white border-0 shadow-sm`}
          >
            {advantage.badge}
          </Badge>
          <Sparkles className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Icon */}
        <div className={`
          ${advantage.iconBg}
          w-16 h-16 rounded-xl
          flex items-center justify-center
          text-primary
          md:group-hover:scale-110
          transition-transform duration-300
        `}>
          {advantage.icon}
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
            {advantage.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {advantage.description}
          </p>
        </div>

        {/* Decorative element */}
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-primary/5 to-transparent rounded-tl-full opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Card>
  )

  return (
    <section className="py-12 md:py-24 bg-gradient-to-b from-background via-muted/30 to-background">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 md:mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t("pages.passenger.advantages.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("pages.passenger.advantages.subtitle")}
          </p>
        </motion.div>

        <div className="md:hidden">
          <Carousel
            setApi={setAdvantagesApi}
            opts={{ align: "start" }}
            className="-mx-1 py-2"
          >
            <CarouselContent className="py-1">
              {advantages.map((advantage, index) => (
                <CarouselItem key={index} className="basis-[88%] pl-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="h-full"
                  >
                    {renderAdvantageCard(advantage)}
                  </motion.div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {Array.from({ length: advantagesCount }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => advantagesApi?.scrollTo(index)}
                className="p-1"
                aria-label={`Go to advantage ${index + 1}`}
                aria-current={advantagesCurrent === index ? "true" : undefined}
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${
                    advantagesCurrent === index
                      ? "w-6 bg-primary"
                      : "w-1.5 bg-primary/30"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {advantages.map((advantage, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {renderAdvantageCard(advantage)}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
