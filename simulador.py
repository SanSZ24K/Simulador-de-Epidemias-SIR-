import argparse

import matplotlib.pyplot as plt


def simular(poblacion, infectados_iniciales, beta, gamma, dias, paso=0.1):
    susceptibles = poblacion - infectados_iniciales
    infectados = infectados_iniciales
    recuperados = 0.0

    tiempos = [0.0]
    valores_s = [susceptibles]
    valores_i = [infectados]
    valores_r = [recuperados]

    cantidad_pasos = int(dias / paso)
    for numero_paso in range(1, cantidad_pasos + 1):
        contagios = min(beta * susceptibles * infectados / poblacion * paso, susceptibles)
        recuperaciones = min(gamma * infectados * paso, infectados)

        susceptibles -= contagios
        infectados += contagios - recuperaciones
        recuperados += recuperaciones

        tiempos.append(numero_paso * paso)
        valores_s.append(susceptibles)
        valores_i.append(infectados)
        valores_r.append(recuperados)

    return tiempos, valores_s, valores_i, valores_r


def main():
    parser = argparse.ArgumentParser(description="Simulador básico del modelo epidemiológico SIR.")
    parser.add_argument("--poblacion", type=int, default=1000, help="Población total (por defecto: 1000).")
    parser.add_argument("--infectados", type=int, default=10, help="Infectados iniciales (por defecto: 10).")
    parser.add_argument("--beta", type=float, default=0.3, help="Tasa de contagio (por defecto: 0.3).")
    parser.add_argument("--gamma", type=float, default=0.1, help="Tasa de recuperación (por defecto: 0.1).")
    parser.add_argument("--dias", type=int, default=160, help="Duración en días (por defecto: 160).")
    args = parser.parse_args()

    if args.poblacion <= 0:
        parser.error("--poblacion debe ser mayor que cero.")
    if not 0 < args.infectados <= args.poblacion:
        parser.error("--infectados debe estar entre 1 y la población total.")
    if args.beta < 0 or args.gamma < 0:
        parser.error("--beta y --gamma no pueden ser negativos.")
    if args.dias <= 0:
        parser.error("--dias debe ser mayor que cero.")

    tiempos, susceptibles, infectados, recuperados = simular(
        args.poblacion, args.infectados, args.beta, args.gamma, args.dias
    )

    plt.plot(tiempos, susceptibles, label="Susceptibles (S)")
    plt.plot(tiempos, infectados, label="Infectados (I)")
    plt.plot(tiempos, recuperados, label="Recuperados (R)")
    plt.xlabel("Días")
    plt.ylabel("Personas")
    plt.title("Simulación del modelo SIR")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig("sir_simulacion.png", dpi=150)
    print(f"Pico de infectados: {max(infectados):.0f} personas")
    print("Gráfico guardado en sir_simulacion.png")
    plt.show()


if __name__ == "__main__":
    main()
