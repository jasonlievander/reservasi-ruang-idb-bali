"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  { src: "/rooms/perpustakaanidb.jpg", position: "center" },
  { src: "/rooms/studio-foto-idb.jpg", position: "center" },
  { src: "/rooms/creative-gallery.jpg", position: "center" },
  { src: "/rooms/aula.jpg", position: "center" },
  { src: "/rooms/lab-fashion.jpg", position: "center" },
  { src: "/rooms/ruang-kelas.jpg", position: "center" },
  { src: "/rooms/lab-imac.jpg", position: "center" },
  { src: "/rooms/lab-komputer.jpg", position: "center" },
];

const SLIDE_INTERVAL_MS = 4000;

export function LoginSlideshow() {
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setActive((current) => (current + 1) % SLIDES.length);
      }
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <div className="login-slideshow" aria-hidden="true">
      {SLIDES.map((slide, index) => (
        <div
          key={slide.src}
          className={`login-slideshow__slide${index === active ? " is-active" : ""}`}
        >
          <Image
            src={slide.src}
            alt=""
            fill
            priority={index === 0}
            sizes="(max-width: 900px) 100vw, 55vw"
            className="login-slideshow__image"
            style={{ objectPosition: slide.position }}
          />
        </div>
      ))}
      <div className="login-slideshow__dots">
        {SLIDES.map((slide, index) => (
          <span
            key={slide.src}
            className={`login-slideshow__dot${index === active ? " is-active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
